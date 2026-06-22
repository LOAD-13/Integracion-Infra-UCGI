package com.ucgi.integrationapi.asterisk;

import java.io.IOException;
import org.asteriskjava.manager.ManagerConnection;
import org.asteriskjava.manager.ManagerConnectionFactory;
import org.asteriskjava.manager.action.CommandAction;
import org.asteriskjava.manager.response.ManagerResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Cliente AMI delgado. Encapsula login/logoff y la ejecución de un comando CLI
 * (típicamente {@code pjsip reload}). Los reintentos los maneja
 * {@link AsteriskProvisioningService} — este cliente reporta el fallo crudo.
 */
@Component
public class AsteriskAmiClient {

    private static final Logger log = LoggerFactory.getLogger(AsteriskAmiClient.class);

    private final AsteriskProperties properties;
    private final ConnectionFactory connectionFactory;

    @Autowired
    public AsteriskAmiClient(AsteriskProperties properties) {
        this(properties, AsteriskAmiClient::defaultFactory);
    }

    /** Constructor para tests: permite inyectar una factory que devuelve un mock. */
    AsteriskAmiClient(AsteriskProperties properties, ConnectionFactory connectionFactory) {
        this.properties = properties;
        this.connectionFactory = connectionFactory;
    }

    /**
     * Ejecuta un comando CLI en Asterisk (ej. {@code "pjsip reload"}) y devuelve la
     * respuesta. Lanza {@link AmiException} si el AMI rechaza login o el comando
     * devuelve error. La conexión se cierra siempre (try-finally interno).
     */
    public String executeCommand(String command) {
        AsteriskProperties.Ami ami = properties.ami();
        ManagerConnection conn = connectionFactory.create(ami);
        try {
            conn.login();
            ManagerResponse response = conn.sendAction(new CommandAction(command), ami.timeoutMs());
            String responseText = response == null ? "" : response.getResponse();
            if (responseText != null && responseText.toLowerCase().startsWith("error")) {
                throw new AmiException("AMI rechazó '" + command + "': " + response.getMessage());
            }
            log.debug("AMI '{}' OK ({})", command, responseText);
            return responseText == null ? "" : responseText;
        } catch (IOException e) {
            throw new AmiException("Fallo conectando/ejecutando AMI '" + command + "'", e);
        } catch (org.asteriskjava.manager.AuthenticationFailedException e) {
            throw new AmiException("AMI auth falló (usuario/secret): " + e.getMessage(), e);
        } catch (org.asteriskjava.manager.TimeoutException e) {
            throw new AmiException("AMI timeout en '" + command + "' (>" + ami.timeoutMs() + "ms)", e);
        } finally {
            try {
                conn.logoff();
            } catch (Exception ignored) {
                // logoff puede fallar si la conexión ya está caída — no es informativo
            }
        }
    }

    public String pjsipReload() {
        return executeCommand("pjsip reload");
    }

    private static ManagerConnection defaultFactory(AsteriskProperties.Ami ami) {
        ManagerConnectionFactory factory = new ManagerConnectionFactory(
                ami.host(), ami.port(), ami.user(), ami.secret());
        return factory.createManagerConnection();
    }

    /** Indirección para inyectar mocks en tests. */
    @FunctionalInterface
    interface ConnectionFactory {
        ManagerConnection create(AsteriskProperties.Ami ami);
    }

    /** Excepción de dominio del cliente AMI. */
    public static class AmiException extends RuntimeException {
        public AmiException(String message) {
            super(message);
        }

        public AmiException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
