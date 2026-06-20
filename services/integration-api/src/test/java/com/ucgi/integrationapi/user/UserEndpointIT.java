package com.ucgi.integrationapi.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class UserEndpointIT extends AbstractIntegrationTest {

    private static final String ADMIN_USERNAME = "users-it-admin";
    private static final String ADMIN_PASSWORD = "secret-1234";
    private static final String AGENT_USERNAME = "users-it-agent";
    private static final String AGENT_PASSWORD = "secret-1234";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockBean private AsteriskProvisioningService provisioningService;

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM users WHERE username IN (?, ?, 'users-it-new')",
                ADMIN_USERNAME, AGENT_USERNAME);
        String adminHash = passwordEncoder.encode(ADMIN_PASSWORD);
        String agentHash = passwordEncoder.encode(AGENT_PASSWORD);
        jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                ADMIN_USERNAME, "admin@users-it.local", "Admin IT", adminHash, "ADMIN", true);
        jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                AGENT_USERNAME, "agent@users-it.local", "Agent IT", agentHash, "AGENTE", true);
    }

    @Test
    void list_200_forAdmin() throws Exception {
        String token = login(ADMIN_USERNAME, ADMIN_PASSWORD);
        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void list_403_forAgent() throws Exception {
        String token = login(AGENT_USERNAME, AGENT_PASSWORD);
        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void list_401_withoutBearer() throws Exception {
        mockMvc.perform(get("/api/v1/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void create_then_update_then_delete_happyPath() throws Exception {
        String token = login(ADMIN_USERNAME, ADMIN_PASSWORD);
        String body = mapper.writeValueAsString(new UserController.UserCreateRequest(
                "users-it-new", "new@users-it.local", "Nuevo Agente",
                "AGENTE", "Secret-12345"));
        MvcResult created = mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("users-it-new"))
                .andExpect(jsonPath("$.role").value("AGENTE"))
                .andReturn();
        long id = mapper.readTree(created.getResponse().getContentAsString())
                .path("id").asLong();

        String updateBody = mapper.writeValueAsString(
                new UserController.UpdateRoleRequest("ADMIN"));
        mockMvc.perform(put("/api/v1/users/" + id + "/role")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));

        mockMvc.perform(delete("/api/v1/users/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    void create_409_whenUsernameAlreadyExists() throws Exception {
        String token = login(ADMIN_USERNAME, ADMIN_PASSWORD);
        String body = mapper.writeValueAsString(new UserController.UserCreateRequest(
                AGENT_USERNAME, "dup@users-it.local", "Dup",
                "AGENTE", "Secret-12345"));
        mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void create_400_whenPasswordTooShort() throws Exception {
        String token = login(ADMIN_USERNAME, ADMIN_PASSWORD);
        String body = mapper.writeValueAsString(new UserController.UserCreateRequest(
                "users-it-bad", "bad@users-it.local", "Bad", "AGENTE", "123"));
        mockMvc.perform(post("/api/v1/users")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    private String login(String username, String password) throws Exception {
        String body = mapper.writeValueAsString(new AuthController.LoginRequest(username, password));
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = mapper.readTree(res.getResponse().getContentAsString());
        return json.path("accessToken").asText();
    }
}
