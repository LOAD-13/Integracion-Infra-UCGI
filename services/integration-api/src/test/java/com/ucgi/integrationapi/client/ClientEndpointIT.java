package com.ucgi.integrationapi.client;

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
class ClientEndpointIT extends AbstractIntegrationTest {

    private static final String AGENT_USERNAME = "clients-test-agent";
    private static final String AGENT_PASSWORD = "secret-1234";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockBean private AsteriskProvisioningService provisioningService;

    @BeforeEach
    void seedAgent() {
        jdbc.update("DELETE FROM users WHERE username = ?", AGENT_USERNAME);
        String hash = passwordEncoder.encode(AGENT_PASSWORD);
        jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                AGENT_USERNAME, "clients-agent@test.local", "Clients Agent",
                hash, "AGENTE", true);
    }

    @Test
    void list_200_returnsSeededClients_withPagination() throws Exception {
        String token = loginAndExtractToken();

        mockMvc.perform(get("/api/v1/clients?size=20")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber())
                .andExpect(jsonPath("$.content[0].name").exists());
    }

    @Test
    void list_filtersBySearchTerm() throws Exception {
        String token = loginAndExtractToken();

        mockMvc.perform(get("/api/v1/clients?q=Mendoza")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.name=='Carla Mendoza')]").exists());
    }

    @Test
    void create_201_andRoundtripsThroughGetUpdateDelete() throws Exception {
        String token = loginAndExtractToken();
        String createBody = mapper.writeValueAsString(new ClientRequest(
                "Cliente Test", "+5199998888", "test@example.com",
                "Empresa Test", "Notas iniciales", null));

        MvcResult created = mockMvc.perform(post("/api/v1/clients")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Cliente Test"))
                .andReturn();
        long id = mapper.readTree(created.getResponse().getContentAsString())
                .path("id").asLong();

        mockMvc.perform(get("/api/v1/clients/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Cliente Test"));

        String updateBody = mapper.writeValueAsString(new ClientRequest(
                "Cliente Actualizado", "+5199998877", "updated@example.com",
                "Empresa Actualizada", null, null));
        mockMvc.perform(put("/api/v1/clients/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Cliente Actualizado"))
                .andExpect(jsonPath("$.notesSummary").doesNotExist());

        mockMvc.perform(delete("/api/v1/clients/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/clients/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_400_whenRequiredFieldsMissing() throws Exception {
        String token = loginAndExtractToken();

        mockMvc.perform(post("/api/v1/clients")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"phone\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_401_withoutBearer() throws Exception {
        mockMvc.perform(get("/api/v1/clients"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void delete_404_whenUnknownId() throws Exception {
        String token = loginAndExtractToken();

        mockMvc.perform(delete("/api/v1/clients/99999999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    private String loginAndExtractToken() throws Exception {
        String body = mapper.writeValueAsString(
                new AuthController.LoginRequest(AGENT_USERNAME, AGENT_PASSWORD));
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = mapper.readTree(res.getResponse().getContentAsString());
        return json.path("accessToken").asText();
    }
}
