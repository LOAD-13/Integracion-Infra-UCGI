package com.ucgi.integrationapi.metrics;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ucgi.integrationapi.AbstractIntegrationTest;
import com.ucgi.integrationapi.asterisk.AsteriskProvisioningService;
import com.ucgi.integrationapi.auth.AuthController;
import java.time.LocalDate;
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
class MetricsEndpointIT extends AbstractIntegrationTest {

    private static final String USER = "metrics-test-agent";
    private static final String PASS = "secret-1234";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    @MockBean private AsteriskProvisioningService provisioningService;

    private Long agentId;
    private final LocalDate today = LocalDate.now();

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM cdr WHERE call_id LIKE 'metrics-it-%'");
        jdbc.update("DELETE FROM users WHERE username = ?", USER);
        String hash = passwordEncoder.encode(PASS);
        jdbc.update("INSERT INTO users (username, email, full_name, password_hash, role, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                USER, "metrics-agent@test.local", "Metrics Agent", hash, "AGENTE", true);
        agentId = jdbc.queryForObject(
                "SELECT id FROM users WHERE username = ?", Long.class, USER);

        insertCdr("metrics-it-1", today.atTime(9, 5), 120, "ANSWERED");
        insertCdr("metrics-it-2", today.atTime(9, 35), 0, "NO_ANSWER");
        insertCdr("metrics-it-3", today.atTime(14, 10), 240, "ANSWERED");
        insertCdr("metrics-it-4", today.atTime(16, 0), 0, "FAILED");
    }

    private void insertCdr(String callId, java.time.LocalDateTime start,
                           int duration, String disposition) {
        jdbc.update("INSERT INTO cdr (call_id, agent_user_id, caller_number, callee_number, "
                        + "direction, start_time, end_time, duration_seconds, disposition) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                callId, agentId, "+51999000001", "1090", "INBOUND",
                start, start.plusSeconds(duration), duration, disposition);
    }

    @Test
    void agent_200_aggregatesToday() throws Exception {
        String token = login();
        mockMvc.perform(get("/api/v1/metrics/agent")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(4))
                .andExpect(jsonPath("$.answeredCount").value(2))
                .andExpect(jsonPath("$.missedCount").value(1))
                .andExpect(jsonPath("$.failedCount").value(1))
                .andExpect(jsonPath("$.averageDurationSeconds").value(180.0))
                .andExpect(jsonPath("$.answerRate").value(0.5))
                .andExpect(jsonPath("$.byHour").isArray())
                .andExpect(jsonPath("$.byHour.length()").value(24))
                .andExpect(jsonPath("$.byHour[9].total").value(2))
                .andExpect(jsonPath("$.byHour[9].answered").value(1));
    }

    @Test
    void agent_401_withoutBearer() throws Exception {
        mockMvc.perform(get("/api/v1/metrics/agent"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void agent_acceptsExplicitDateParam() throws Exception {
        String token = login();
        mockMvc.perform(get("/api/v1/metrics/agent?date=" + today)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(today.toString()));
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
