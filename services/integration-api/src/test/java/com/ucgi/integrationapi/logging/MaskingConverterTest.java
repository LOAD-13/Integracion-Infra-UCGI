package com.ucgi.integrationapi.logging;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

class MaskingConverterTest {

    private final MaskingConverter converter = new MaskingConverter();

    @Test
    void enmascaraPasswordEnFormatoKeyValue() {
        assertThat(convert("Conectando con password=Sup3rSecret! a la DB"))
            .contains("password=***")
            .doesNotContain("Sup3rSecret");
    }

    @Test
    void enmascaraPasswordEnJsonString() {
        assertThat(convert("{\"username\":\"admin\",\"password\":\"Sup3rSecret!\"}"))
            .contains("\"password\":\"***\"")
            .doesNotContain("Sup3rSecret");
    }

    @Test
    void enmascaraAuthorizationBearer() {
        assertThat(convert("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig"))
            .contains("Bearer ***")
            .doesNotContain("eyJhbGciOiJIUzI1NiI");
    }

    @Test
    void enmascaraSipSecret() {
        assertThat(convert("Provisioning sip_secret=joa1003 OK"))
            .contains("sip_secret=***")
            .doesNotContain("joa1003");
    }

    @Test
    void enmascaraApiKey() {
        assertThat(convert("apiKey=d5d3f1e4cb571242535f6f5f966d77e1"))
            .contains("apiKey=***")
            .doesNotContain("d5d3f1e4");
    }

    @Test
    void enmascaraAdminPassword() {
        assertThat(convert("mikoPbxAdminPassword=Deathnote2005 conectando"))
            .contains("PbxAdminPassword=***")
            .doesNotContain("Deathnote2005");
    }

    @Test
    void noToca_mensajesSinSecretos() {
        String original = "Llamada agente1 → agente2 establecida en 240ms";
        assertThat(convert(original)).isEqualTo(original);
    }

    private String convert(String message) {
        LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
        Logger logger = context.getLogger(MaskingConverterTest.class);
        LoggingEvent event = new LoggingEvent(
            MaskingConverterTest.class.getName(),
            logger,
            Level.INFO,
            message,
            null,
            null
        );
        return converter.convert(event);
    }
}
