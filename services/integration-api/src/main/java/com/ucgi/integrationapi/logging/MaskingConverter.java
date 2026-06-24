package com.ucgi.integrationapi.logging;

import ch.qos.logback.classic.pattern.ClassicConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Enmascara secretos en mensajes de log. Activado vía logback-spring.xml como
 * conversion word {@code %mask}. Cumple ISO 27001 A.8.10 (uso aceptable de
 * información) — los secretos nunca pueden aparecer en claro en evidencia
 * persistida.
 *
 * Patrones cubiertos:
 * <ul>
 *   <li>{@code password=...} / {@code "password":"..."}</li>
 *   <li>{@code Authorization: Bearer ...} / {@code Basic ...}</li>
 *   <li>{@code sip_secret=...}</li>
 *   <li>{@code apiKey=...} / {@code X-Api-Key: ...}</li>
 *   <li>{@code adminPassword=...}</li>
 *   <li>{@code mikoPbxAdminPassword=...}</li>
 * </ul>
 *
 * Cualquier nuevo campo sensible se suma a {@link #PATTERNS} sin tocar nada más.
 */
public class MaskingConverter extends ClassicConverter {

    private static final String MASK = "***";

    /**
     * Pares (regex, replacement). Cada regex captura el valor sensible en el
     * grupo {@code 1} para que la sustitución preserve el prefijo identificador
     * que da contexto al humano que lee el log.
     */
    /**
     * Orden importa: las versiones JSON (con comillas) corren primero, así su
     * resultado {@code key":"***"} no es re-matched por la versión key=value
     * (que excluye {@code "} del valor capturado para no romper el JSON ya
     * enmascarado).
     */
    /**
     * Orden importa: las versiones JSON-estrictas ({@code "key":"value"}) corren
     * primero. Las versiones key=value excluyen {@code "} del valor capturado
     * para no romper JSON ya enmascarado.
     */
    private static final List<Pattern> PATTERNS = List.of(
        // password: JSON-strict (con comillas) + key=value
        Pattern.compile("(?i)(\"password\"\\s*:\\s*\")[^\"]+(\")"),
        Pattern.compile("(?i)(password\\s*[=:]\\s*)[^\\s\",;}]+"),
        // sip_secret
        Pattern.compile("(?i)(\"sip_secret\"\\s*:\\s*\")[^\"]+(\")"),
        Pattern.compile("(?i)(sip_secret\\s*[=:]\\s*)[^\\s\",;}]+"),
        // api_key / apiKey / api-key
        Pattern.compile("(?i)(\"api[_-]?key\"\\s*:\\s*\")[^\"]+(\")"),
        Pattern.compile("(?i)(api[_-]?key\\s*[=:]\\s*)[^\\s\",;}]+"),
        // Authorization / X-Api-Key headers
        Pattern.compile("(?i)(authorization:\\s*bearer\\s+)[A-Za-z0-9._\\-+/=]+"),
        Pattern.compile("(?i)(authorization:\\s*basic\\s+)[A-Za-z0-9+/=]+"),
        Pattern.compile("(?i)(x-api-key:\\s*)[^\\s]+"),
        // adminPassword / mikoPbxAdminPassword / admin_password
        Pattern.compile("(?i)(\"admin[_-]?password\"\\s*:\\s*\")[^\"]+(\")"),
        Pattern.compile("(?i)(admin[_-]?password\\s*[=:]\\s*)[^\\s\",;}]+")
    );

    @Override
    public String convert(final ILoggingEvent event) {
        String message = event.getFormattedMessage();
        for (Pattern pattern : PATTERNS) {
            int groupCount = pattern.matcher(message).groupCount();
            String replacement = groupCount >= 2 ? "$1" + MASK + "$2" : "$1" + MASK;
            message = pattern.matcher(message).replaceAll(replacement);
        }
        return message;
    }
}
