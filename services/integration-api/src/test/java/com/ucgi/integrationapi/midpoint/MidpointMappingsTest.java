package com.ucgi.integrationapi.midpoint;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.InputStream;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;

/**
 * Pruebas unitarias de los mappings configurados en midPoint (HU-05.4,
 * IUDCYGI-36). Cubren:
 *
 * <ol>
 *   <li>Validación XML well-formed de los 3 artefactos
 *       ({@code resource-crm-sql.xml}, {@code resource-integration-api.xml},
 *       {@code role-agente-callcenter.xml}) — protege contra editoreos
 *       inadvertidos que rompan la importación en midPoint.</li>
 *   <li>Lógica de generación de extensión: replica el snippet Groovy del
 *       outbound del recurso REST (UUID → {@code "1" + (hash % 100)}) y
 *       valida que las extensiones quedan en el rango [1000, 1099].</li>
 *   <li>Lógica de generación de password: SecureRandom + Base64 URL-safe,
 *       longitud {@code >= 12} (criterio DoD), sin caracteres prohibidos.</li>
 *   <li>Mapping bidireccional CRM SQL: el script de conversión
 *       {@code active ↔ administrativeStatus} produce el valor esperado.</li>
 * </ol>
 *
 * Estos tests viven en el módulo Java por dos razones: el CI ya ejecuta
 * Surefire en build-api (Sprint 4 los activará con HU-06.2), y la lógica
 * que validamos coincide con la del integration-api (HU-03.8 — la generación
 * real de credenciales también podría hacerse acá si midPoint estuviera
 * caído, según el flujo de fallback documentado en HU-05.3).
 */
class MidpointMappingsTest {

    @Test
    @DisplayName("Los 3 XMLs (2 recursos + 1 rol) son well-formed")
    void xmlArtifactsAreWellFormed() throws Exception {
        parseClasspathXml("midpoint/resource-crm-sql.xml");
        parseClasspathXml("midpoint/resource-integration-api.xml");
        parseClasspathXml("midpoint/role-agente-callcenter.xml");
    }

    @Test
    @DisplayName("Generación de extensión: UUID → '10XX' siempre en [1000,1099]")
    void extensionGeneration_keepsRange() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String extension = deriveExtension(UUID.randomUUID().toString());
            assertThat(extension).matches("^1\\d{3}$");
            int parsed = Integer.parseInt(extension);
            assertThat(parsed).isBetween(1000, 1099);
            seen.add(extension);
        }
        // El rango es de 100 valores; con 1000 muestras al menos deberíamos
        // haber visto ≥ 50 valores únicos (probabilidad astronómicamente alta).
        assertThat(seen.size()).isGreaterThanOrEqualTo(50);
    }

    @Test
    @DisplayName("Generación de extensión es determinística para el mismo UUID")
    void extensionGeneration_isDeterministic() {
        String uuid = "11111111-1111-1111-1111-111111111111";
        String first = deriveExtension(uuid);
        String second = deriveExtension(uuid);
        assertThat(first).isEqualTo(second);
    }

    @Test
    @DisplayName("Generación de extensión rechaza entradas nulas o vacías")
    void extensionGeneration_failsOnBlankInput() {
        assertThatThrownBy(() -> deriveExtension(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> deriveExtension(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Generación de password: 24 chars URL-safe sin '=', '+', '/'")
    void passwordGeneration_meetsPolicy() {
        for (int i = 0; i < 500; i++) {
            String password = generateSipPassword();
            assertThat(password).hasSize(24);
            assertThat(password).doesNotContain("=", "+", "/");
            // El criterio DoD pide >= 12 — confirmamos amplio margen.
            assertThat(password.length()).isGreaterThanOrEqualTo(12);
            // URL-safe Base64 valida con [A-Za-z0-9_-]
            assertThat(password).matches("^[A-Za-z0-9_-]+$");
        }
    }

    @Test
    @DisplayName("Mapping CRM SQL: active=true ↔ 'enabled', active=false ↔ 'disabled'")
    void crmActiveMapping_bidirectional() {
        assertThat(activeToStatus(true)).isEqualTo("enabled");
        assertThat(activeToStatus(false)).isEqualTo("disabled");
        assertThat(statusToActive("enabled")).isTrue();
        assertThat(statusToActive("disabled")).isFalse();
    }

    // ------------------------------------------------------------------
    // Mapping helpers — replican la lógica que vive en los scripts Groovy.
    // ------------------------------------------------------------------

    private static String deriveExtension(String uuid) {
        if (uuid == null || uuid.isBlank()) {
            throw new IllegalArgumentException("UUID requerido");
        }
        String cleaned = uuid.replace("-", "");
        String tail = cleaned.substring(cleaned.length() - 2);
        int hash = Integer.parseInt(tail, 16);
        return "1" + String.format("%03d", hash % 100);
    }

    private static String generateSipPassword() {
        byte[] bytes = new byte[18];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String activeToStatus(boolean active) {
        return active ? "enabled" : "disabled";
    }

    private static boolean statusToActive(String status) {
        return "enabled".equalsIgnoreCase(status);
    }

    private static void parseClasspathXml(String resourcePath) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        try (InputStream in = MidpointMappingsTest.class.getClassLoader()
                .getResourceAsStream(resourcePath)) {
            assertThat(in)
                    .as("Recurso classpath %s no encontrado — verificar que "
                            + "src/test/resources/midpoint/ esté sincronizado con "
                            + "infra/midpoint/", resourcePath)
                    .isNotNull();
            Document doc = factory.newDocumentBuilder().parse(in);
            assertThat(doc.getDocumentElement()).isNotNull();
        }
    }
}
