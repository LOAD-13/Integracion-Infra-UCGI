package com.ucgi.integrationapi.cdr;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ucgi.integrationapi.AbstractIntegrationTest;
import com.ucgi.integrationapi.asterisk.AsteriskProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@WithMockUser(roles = "ADMIN")
class CdrEndpointIT extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    @MockBean private AsteriskProvisioningService provisioningService;

    @BeforeEach
    void seedCdr() {
        jdbc.update("DELETE FROM cdr WHERE call_id LIKE 'IT-%'");
        // 3 registros — distintos timestamps, agentes y dispositions
        jdbc.update("INSERT INTO cdr (call_id, agent_user_id, client_id, caller_number, callee_number, "
                + "direction, start_time, answer_time, end_time, duration_seconds, disposition) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                "IT-001", 2L, 1L, "1001", "+51999111001", "OUTBOUND",
                "2026-06-19 10:00:00", "2026-06-19 10:00:05", "2026-06-19 10:02:05", 120, "ANSWERED");
        jdbc.update("INSERT INTO cdr (call_id, agent_user_id, client_id, caller_number, callee_number, "
                + "direction, start_time, answer_time, end_time, duration_seconds, disposition) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                "IT-002", 2L, 2L, "1001", "+51999111002", "OUTBOUND",
                "2026-06-19 11:00:00", null, "2026-06-19 11:00:25", 25, "NO_ANSWER");
        jdbc.update("INSERT INTO cdr (call_id, agent_user_id, client_id, caller_number, callee_number, "
                + "direction, start_time, answer_time, end_time, duration_seconds, disposition) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                "IT-003", 3L, 4L, "1002", "+51999111004", "OUTBOUND",
                "2026-06-19 12:00:00", "2026-06-19 12:00:03", "2026-06-19 12:01:03", 60, "ANSWERED");
    }

    @Test
    void listsAllWithDefaultPagination_orderedByStartTimeDesc() throws Exception {
        mockMvc.perform(get("/api/v1/cdr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].callId").value("IT-003"))   // más reciente primero
                .andExpect(jsonPath("$.content[1].callId").value("IT-002"))
                .andExpect(jsonPath("$.content[2].callId").value("IT-001"));
    }

    @Test
    void filtersByAgent() throws Exception {
        mockMvc.perform(get("/api/v1/cdr").param("agentUserId", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].callId").value("IT-003"));
    }

    @Test
    void filtersByDisposition() throws Exception {
        mockMvc.perform(get("/api/v1/cdr").param("disposition", "ANSWERED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2));
    }

    @Test
    void filtersByDateRange() throws Exception {
        mockMvc.perform(get("/api/v1/cdr")
                        .param("from", "2026-06-19T10:30:00")
                        .param("to", "2026-06-19T11:30:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].callId").value("IT-002"));
    }

    @Test
    void combinedFilters_agentAndDisposition() throws Exception {
        mockMvc.perform(get("/api/v1/cdr")
                        .param("agentUserId", "2")
                        .param("disposition", "ANSWERED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].callId").value("IT-001"));
    }

    @Test
    void respectsPaginationSize() throws Exception {
        mockMvc.perform(get("/api/v1/cdr").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(3)))
                .andExpect(jsonPath("$.totalPages").value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
    }

    // 401 sin token está cubierto en AuthEndpointIT.protectedEndpoint_401_withoutBearer
}
