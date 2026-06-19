package com.ucgi.integrationapi.asterisk;

import com.ucgi.integrationapi.mikopbx.MikoPbxException;
import com.ucgi.integrationapi.mikopbx.MikoPbxProperties;
import com.ucgi.integrationapi.mikopbx.MikoPbxRestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Orquesta el provisioning Asterisk tras un alta de extensión.
 *
 * <p><b>Fase 1 (HU-03.3/03.4)</b> — escribir {@code pjsip-dynamic.conf} y disparar
 * {@code pjsip reload} por AMI. Código en {@code com.ucgi.integrationapi.pjsip} y
 * {@code com.ucgi.integrationapi.asterisk.AsteriskAmiClient} (se conserva como
 * evidencia histórica, sin uso).
 *
 * <p><b>Fase 2 (HU-03.8)</b> — desde el pivote a MikoPBX, hacemos {@code POST
 * /pbxcore/api/v3/employees} contra la REST API. MikoPBX crea User + Extension
 * + SIP de una y aplica el cambio en caliente sin reload manual.
 *
 * <p>Si el REST falla tras los reintentos, NO se propaga al caller HTTP — la
 * persistencia en {@code crm.sip_extensions} ya tuvo éxito y la sincronización
 * se reintenta en el siguiente trigger (manual o downgrade automático HU-03.7).
 */
@Service
public class AsteriskProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(AsteriskProvisioningService.class);

    private final MikoPbxRestClient mikoPbxClient;
    private final MikoPbxProperties properties;
    private final Sleeper sleeper;

    public AsteriskProvisioningService(MikoPbxRestClient mikoPbxClient,
                                       MikoPbxProperties properties) {
        this(mikoPbxClient, properties, Thread::sleep);
    }

    /** Constructor para tests: permite mockear el sleep entre reintentos. */
    AsteriskProvisioningService(MikoPbxRestClient mikoPbxClient,
                                MikoPbxProperties properties,
                                Sleeper sleeper) {
        this.mikoPbxClient = mikoPbxClient;
        this.properties = properties;
        this.sleeper = sleeper;
    }

    /**
     * Crea (o asegura) la extensión SIP en MikoPBX vía REST. Llamar tras un
     * commit exitoso en {@code crm.sip_extensions} (ver listener
     * {@code SipExtensionService#onPersisted}).
     */
    public ProvisioningResult provisionExtension(String number, String displayName, String sipSecret) {
        MikoPbxProperties.Retry cfg = properties.retry();
        long backoff = cfg.initialBackoffMs();
        for (int attempt = 1; attempt <= cfg.maxAttempts(); attempt++) {
            try {
                MikoPbxRestClient.CreatedEmployee created =
                        mikoPbxClient.createEmployee(number, displayName, sipSecret);
                if (attempt > 1) {
                    log.info("createEmployee {} OK al intento {}/{}",
                            number, attempt, cfg.maxAttempts());
                }
                return new ProvisioningResult(true, attempt, created.id(), null);
            } catch (MikoPbxException e) {
                log.warn("createEmployee {} falló intento {}/{}: {}",
                        number, attempt, cfg.maxAttempts(), e.getMessage());
                if (attempt == cfg.maxAttempts()) {
                    log.error("Agotados {} intentos para extensión {} — sin propagar al caller",
                            cfg.maxAttempts(), number);
                    return new ProvisioningResult(false, attempt, null, e.getMessage());
                }
                try {
                    sleeper.sleep(backoff);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return new ProvisioningResult(false, attempt, null, "interrumpido");
                }
                backoff = (long) (backoff * cfg.backoffMultiplier());
            }
        }
        return new ProvisioningResult(false, cfg.maxAttempts(), null, "loop sin progreso");
    }

    public record ProvisioningResult(boolean success, int attempts, String mikoPbxId, String error) {
    }

    @FunctionalInterface
    interface Sleeper {
        void sleep(long millis) throws InterruptedException;
    }
}
