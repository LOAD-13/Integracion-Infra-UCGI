package com.ucgi.integrationapi.sipextension;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ucgi.integrationapi.AbstractIntegrationTest;
import com.ucgi.integrationapi.asterisk.AsteriskProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "DELETE FROM sip_extensions WHERE extension_number IN ('1900','1901','1902','1903')"
}, executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
class SipExtensionEndpointIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /** Reemplaza el provisioning real para que el listener post-commit no intente
     *  conectarse a Asterisk durante los tests. */
    @MockBean
    private AsteriskProvisioningService provisioningService;

    @Test
    void createsExtension_201_andLocationHeader() throws Exception {
        String body = objectMapper.writeValueAsString(new SipExtensionCreateRequest(
                "admin", "secret-1234", "1900", "Admin del CRM"));

        mockMvc.perform(post("/api/v1/sip-extensions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.extensionNumber").value("1900"))
                .andExpect(jsonPath("$.enabled").value(true));
    }

    @Test
    void rejectsInvalidPayload_400_withFieldErrors() throws Exception {
        String body = objectMapper.writeValueAsString(new SipExtensionCreateRequest(
                "", "x", "ABC", null));

        mockMvc.perform(post("/api/v1/sip-extensions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors").isArray())
                .andExpect(jsonPath("$.fieldErrors.length()").value(3));
    }

    @Test
    void rejectsUnknownUser_404() throws Exception {
        String body = objectMapper.writeValueAsString(new SipExtensionCreateRequest(
                "nobody", "secret-1234", "1901", null));

        mockMvc.perform(post("/api/v1/sip-extensions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void rejectsDuplicateExtensionNumber_409() throws Exception {
        // 1001 ya existe en el seed (agente1)
        String body = objectMapper.writeValueAsString(new SipExtensionCreateRequest(
                "admin", "secret-1234", "1001", null));

        mockMvc.perform(post("/api/v1/sip-extensions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void rejectsDuplicateUser_409() throws Exception {
        // agente1 ya tiene la extensión 1001 asignada en el seed
        String body = objectMapper.writeValueAsString(new SipExtensionCreateRequest(
                "agente1", "secret-1234", "1902", null));

        mockMvc.perform(post("/api/v1/sip-extensions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }
}
