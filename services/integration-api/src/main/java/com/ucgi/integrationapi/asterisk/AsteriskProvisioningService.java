package com.ucgi.integrationapi.asterisk;

import com.ucgi.integrationapi.pjsip.PjsipConfigWriter;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Orquesta el flujo de provisioning Asterisk tras un alta/baja/modificación:
 * <ol>
 *   <li>Regenerar el archivo dinámico en disco con {@link PjsipConfigWriter}.</li>
 *   <li>Disparar {@code pjsip reload} vía AMI con reintentos exponenciales.</li>
 * </ol>
 *
 * <p>Si el AMI está temporalmente caído tras agotar los reintentos, el método
 * NO lanza excepción al caller — el provisioning de la BD ya tuvo éxito y los
 * cambios se aplicarán en el próximo reload (manual o por la cola de retry de
 * HU-03.7). Se loggea como WARN para que Prometheus pueda alertar.
 */
@Service
public class AsteriskProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(AsteriskProvisioningService.class);

    private final PjsipConfigWriter writer;
    private final AsteriskAmiClient amiClient;
    private final AsteriskProperties properties;
    private final Sleeper sleeper;

    public AsteriskProvisioningService(PjsipConfigWriter writer,
                                       AsteriskAmiClient amiClient,
                                       AsteriskProperties properties) {
        this(writer, amiClient, properties, Thread::sleep);
    }

    /** Constructor para tests: permite mockear el sleep entre reintentos. */
    AsteriskProvisioningService(PjsipConfigWriter writer,
                                AsteriskAmiClient amiClient,
                                AsteriskProperties properties,
                                Sleeper sleeper) {
        this.writer = writer;
        this.amiClient = amiClient;
        this.properties = properties;
        this.sleeper = sleeper;
    }

    /**
     * Llamar tras alta/baja/modificación de una extensión SIP. Es el único punto
     * de coordinación entre persistencia y configuración runtime de Asterisk.
     */
    public ProvisioningResult provision() {
        Path target = Path.of(properties.configPath());
        writer.writeTo(target);
        return reloadWithRetry();
    }

    private ProvisioningResult reloadWithRetry() {
        AsteriskProperties.Reload cfg = properties.reload();
        long backoff = cfg.initialBackoffMs();
        for (int attempt = 1; attempt <= cfg.maxAttempts(); attempt++) {
            try {
                amiClient.pjsipReload();
                if (attempt > 1) {
                    log.info("pjsip reload OK al intento {}/{}", attempt, cfg.maxAttempts());
                }
                return new ProvisioningResult(true, attempt, null);
            } catch (AsteriskAmiClient.AmiException e) {
                log.warn("pjsip reload falló intento {}/{}: {}", attempt, cfg.maxAttempts(), e.getMessage());
                if (attempt == cfg.maxAttempts()) {
                    log.error("Agotados {} intentos de pjsip reload — dejando para próximo trigger", cfg.maxAttempts());
                    return new ProvisioningResult(false, attempt, e.getMessage());
                }
                try {
                    sleeper.sleep(backoff);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return new ProvisioningResult(false, attempt, "interrumpido");
                }
                backoff = (long) (backoff * cfg.backoffMultiplier());
            }
        }
        return new ProvisioningResult(false, cfg.maxAttempts(), "loop sin progreso");
    }

    public record ProvisioningResult(boolean reloaded, int attempts, String error) {
    }

    @FunctionalInterface
    interface Sleeper {
        void sleep(long millis) throws InterruptedException;
    }
}
