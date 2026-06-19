package com.ucgi.integrationapi.me;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ucgi.integrationapi.AbstractIntegrationTest;
import com.ucgi.integrationapi.asterisk.AsteriskProvisioningService;
import com.ucgi.integrationapi.auth.AuthController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@AutoConfigureMockMvc
class MeEndpointIT extends AbstractIntegrationTest {

    private static final String AGENT_USERNAME = "me-test-agent";
    private static final String AGENT_PASSWORD = "secret-1234";
    private static final String AGENT_EXT = "1990";
    private static final String AGENT_SIP_PASSWORD = "sip-passwd-1990";
    private static final String ORPHAN_USERNAME = "me-test-orphan";
    private static final String ORPHAN_PASSWORD = "secret-1234";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockBean private AsteriskProvisioningService provisioningService;

    @BeforeEach
    void seedFixtures() {
        jdbc.update("DELETE FROM sip_extensions WHERE extension_number = ?", AGENT_EXT);
        jdbc.update("DELETE FROM users WHERE username IN (?, ?)",
                AGENT_USERNAME, ORPHAN_USERNAME);

        String hash = passwordEncoder.encode(AGENT_PASSWORD);
        jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                AGENT_USERNAME, "me-agent@test.local", "Agente Test", hash, "AGENTE", true);
        Long agentId = jdbc.queryForObject(
                "SELECT id FROM users WHERE username = ?", Long.class, AGENT_USERNAME);
        jdbc.update("INSERT INTO sip_extensions (user_id, extension_number, sip_password, enabled) "
                        + "VALUES (?, ?, ?, ?)",
                agentId, AGENT_EXT, AGENT_SIP_PASSWORD, true);

        String orphanHash = passwordEncoder.encode(ORPHAN_PASSWORD);
        jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                ORPHAN_USERNAME, "orphan@test.local", "Sin Extensión",
                orphanHash, "AGENTE", true);
    }

    @Test
    void sipCredentials_200_andReturnsExtensionForAuthenticatedAgent() throws Exception {
        String token = loginAndExtractToken(AGENT_USERNAME, AGENT_PASSWORD);

        mockMvc.perform(get("/api/v1/me/sip-credentials")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.extension").value(AGENT_EXT))
                .andExpect(jsonPath("$.displayName").value("Agente Test"))
                .andExpect(jsonPath("$.secret").value(AGENT_SIP_PASSWORD));
    }

    @Test
    void sipCredentials_401_withoutBearer() throws Exception {
        mockMvc.perform(get("/api/v1/me/sip-credentials"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sipCredentials_404_whenUserHasNoSipExtension() throws Exception {
        String token = loginAndExtractToken(ORPHAN_USERNAME, ORPHAN_PASSWORD);

        mockMvc.perform(get("/api/v1/me/sip-credentials")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void sipCredentials_404_whenExtensionIsDisabled() throws Exception {
        jdbc.update("UPDATE sip_extensions SET enabled = FALSE WHERE extension_number = ?",
                AGENT_EXT);
        String token = loginAndExtractToken(AGENT_USERNAME, AGENT_PASSWORD);

        mockMvc.perform(get("/api/v1/me/sip-credentials")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    private String loginAndExtractToken(String username, String password) throws Exception {
        String body = mapper.writeValueAsString(
                new AuthController.LoginRequest(username, password));
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = mapper.readTree(res.getResponse().getContentAsString());
        return json.path("accessToken").asText();
    }
}
