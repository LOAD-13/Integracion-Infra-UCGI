package com.ucgi.integrationapi.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ucgi.integrationapi.AbstractIntegrationTest;
import com.ucgi.integrationapi.asterisk.AsteriskProvisioningService;
import com.ucgi.integrationapi.sipextension.SipExtensionCreateRequest;
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
class AuthEndpointIT extends AbstractIntegrationTest {

    private static final String TEST_USERNAME = "auth-test-user";
    private static final String TEST_PASSWORD = "secret-1234";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockBean private AsteriskProvisioningService provisioningService;

    @BeforeEach
    void seedTestUser() {
        String hash = passwordEncoder.encode(TEST_PASSWORD);
        jdbc.update("DELETE FROM users WHERE username = ?", TEST_USERNAME);
        jdbc.update(
                "INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                TEST_USERNAME, "auth@test.local", "Auth Test", hash, "ADMIN", true);
    }

    @Test
    void login_200_andReturnsBearerToken_withValidCredentials() throws Exception {
        String body = mapper.writeValueAsString(
                new AuthController.LoginRequest(TEST_USERNAME, TEST_PASSWORD));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").isNumber())
                .andExpect(jsonPath("$.username").value(TEST_USERNAME))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void login_401_withWrongPassword() throws Exception {
        String body = mapper.writeValueAsString(
                new AuthController.LoginRequest(TEST_USERNAME, "wrong-password"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void login_401_withUnknownUser() throws Exception {
        String body = mapper.writeValueAsString(
                new AuthController.LoginRequest("nobody-here", TEST_PASSWORD));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_400_withEmptyPayload() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void protectedEndpoint_401_withoutBearer() throws Exception {
        String body = mapper.writeValueAsString(new SipExtensionCreateRequest(
                "admin", "secret-1234", "1900", "Admin"));

        mockMvc.perform(post("/api/v1/sip-extensions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpoint_201_withValidBearer() throws Exception {
        String token = loginAndExtractToken();

        String body = mapper.writeValueAsString(new SipExtensionCreateRequest(
                "admin", "secret-1234", "1908", "Admin"));

        // Cleanup en caso de corrida previa
        jdbc.update("DELETE FROM sip_extensions WHERE extension_number = '1908'");

        mockMvc.perform(post("/api/v1/sip-extensions")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    @Test
    void actuatorHealth_200_withoutBearer() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    private String loginAndExtractToken() throws Exception {
        String body = mapper.writeValueAsString(
                new AuthController.LoginRequest(TEST_USERNAME, TEST_PASSWORD));
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = mapper.readTree(res.getResponse().getContentAsString());
        return json.path("accessToken").asText();
    }
}
