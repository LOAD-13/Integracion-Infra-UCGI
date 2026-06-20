package com.ucgi.integrationapi.note;

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
class NoteEndpointIT extends AbstractIntegrationTest {

    private static final String USER = "note-test-agent";
    private static final String PASS = "secret-1234";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockBean private AsteriskProvisioningService provisioningService;

    private Long clientId;

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM users WHERE username = ?", USER);
        String hash = passwordEncoder.encode(PASS);
        jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                USER, "note@test.local", "Note Agent", hash, "AGENTE", true);

        jdbc.update("INSERT INTO clients (name, phone, email, company) "
                        + "VALUES (?, ?, ?, ?)",
                "Cliente Notas Test", "+5199987001", "notas-test@example.com",
                "Empresa Notas");
        clientId = jdbc.queryForObject(
                "SELECT id FROM clients WHERE phone = '+5199987001'", Long.class);
    }

    @Test
    void roundtrip_createListUpdate() throws Exception {
        String token = login();

        String createBody = mapper.writeValueAsString(
                new NoteRequest(clientId, null, "Primera nota"));
        MvcResult created = mockMvc.perform(post("/api/v1/notes")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.body").value("Primera nota"))
                .andExpect(jsonPath("$.authorUserId").isNumber())
                .andReturn();
        long noteId = mapper.readTree(created.getResponse().getContentAsString())
                .path("id").asLong();

        mockMvc.perform(get("/api/v1/notes?clientId=" + clientId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].body").value("Primera nota"));

        String updateBody = mapper.writeValueAsString(
                new NoteUpdateRequest("Primera nota (editada)"));
        mockMvc.perform(put("/api/v1/notes/" + noteId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("Primera nota (editada)"));
    }

    @Test
    void create_401_withoutBearer() throws Exception {
        String body = mapper.writeValueAsString(
                new NoteRequest(clientId, null, "x"));
        mockMvc.perform(post("/api/v1/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void update_404_whenNoteDoesNotExist() throws Exception {
        String token = login();
        String body = mapper.writeValueAsString(new NoteUpdateRequest("nada"));
        mockMvc.perform(put("/api/v1/notes/99999999")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound());
    }

    private String login() throws Exception {
        String body = mapper.writeValueAsString(new AuthController.LoginRequest(USER, PASS));
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = mapper.readTree(res.getResponse().getContentAsString());
        return json.path("accessToken").asText();
    }
}
