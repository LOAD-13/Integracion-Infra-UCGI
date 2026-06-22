package com.ucgi.integrationapi.sipextension;

import com.ucgi.integrationapi.asterisk.AsteriskProvisioningService;
import com.ucgi.integrationapi.mikopbx.MikoPbxException;
import com.ucgi.integrationapi.mikopbx.MikoPbxRestClient;
import com.ucgi.integrationapi.user.User;
import com.ucgi.integrationapi.user.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Provisiona en MikoPBX, al startup del integration-api, las extensiones SIP que
 * existen en {@code crm.sip_extensions} pero todavía no en MikoPBX.
 *
 * <p>Reemplaza la necesidad de crear extensiones manualmente desde la GUI de
 * MikoPBX tras un {@code docker compose down -v}. Idempotente: lista las
 * extensiones que MikoPBX ya conoce y solo crea las faltantes.
 *
 * <p>Si MikoPBX no responde al listar (ej. todavía no booteó o cred mala),
 * registra el error y no aborta el startup del integration-api — la API REST
 * sigue siendo usable para CRUD del CRM aunque la provisión esté caída.
 *
 * <p>Desactivable con {@code ucgi.bootstrap.sip-extensions=false} para tests o
 * para escenarios donde la provisión la gestione midPoint.
 */
@Component
@ConditionalOnProperty(name = "ucgi.bootstrap.sip-extensions", havingValue = "true", matchIfMissing = true)
public class SipExtensionBootstrapper implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SipExtensionBootstrapper.class);

    private final SipExtensionRepository repository;
    private final UserRepository users;
    private final MikoPbxRestClient mikoPbxClient;
    private final AsteriskProvisioningService provisioningService;

    @Autowired
    public SipExtensionBootstrapper(SipExtensionRepository repository,
                                    UserRepository users,
                                    MikoPbxRestClient mikoPbxClient,
                                    AsteriskProvisioningService provisioningService) {
        this.repository = repository;
        this.users = users;
        this.mikoPbxClient = mikoPbxClient;
        this.provisioningService = provisioningService;
    }

    @Override
    public void run(org.springframework.boot.ApplicationArguments args) {
        List<SipExtension> wanted = repository.findAllByEnabledTrueOrderByExtensionNumberAsc();
        if (wanted.isEmpty()) {
            log.info("SipExtensionBootstrapper: no hay extensiones habilitadas en la BD — nada que provisionar");
            return;
        }

        Set<String> alreadyInPbx;
        try {
            alreadyInPbx = new HashSet<>(mikoPbxClient.listExtensionNumbers());
        } catch (MikoPbxException e) {
            log.warn("SipExtensionBootstrapper: no se pudo listar extensiones en MikoPBX — sigo sin provisionar. Error: {}", e.getMessage());
            return;
        }

        int created = 0;
        int skipped = 0;
        int failed = 0;
        for (SipExtension ext : wanted) {
            String number = ext.getExtensionNumber();
            if (alreadyInPbx.contains(number)) {
                skipped++;
                continue;
            }
            String displayName = users.findById(ext.getUserId())
                    .map(this::niceName)
                    .orElse("Agent-" + number);
            AsteriskProvisioningService.ProvisioningResult result =
                    provisioningService.provisionExtension(number, displayName, ext.getSipPassword());
            if (result.success()) {
                created++;
                log.info("SipExtensionBootstrapper: ext {} creada en MikoPBX (id={})", number, result.mikoPbxId());
            } else {
                failed++;
                log.error("SipExtensionBootstrapper: ext {} no pudo ser creada: {}", number, result.error());
            }
        }

        log.info("SipExtensionBootstrapper: revisadas {} ext (creadas={}, ya presentes={}, fallidas={})",
                wanted.size(), created, skipped, failed);
    }

    private String niceName(User user) {
        String full = user.getFullName();
        return full != null && !full.isBlank() ? full : user.getUsername();
    }
}
