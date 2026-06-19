package com.ucgi.integrationapi.asterisk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ucgi.integrationapi.mikopbx.MikoPbxException;
import com.ucgi.integrationapi.mikopbx.MikoPbxProperties;
import com.ucgi.integrationapi.mikopbx.MikoPbxRestClient;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class AsteriskProvisioningServiceTest {

    private final MikoPbxRestClient mikoPbx = mock(MikoPbxRestClient.class);
    private final MikoPbxProperties properties = new MikoPbxProperties(
            "mikopbx", 80, "admin", "secret", 3000, 5000,
            new MikoPbxProperties.Retry(3, 100, 2.0));

    @Test
    void provision_happyPath_returnsSuccess() {
        when(mikoPbx.createEmployee(anyString(), anyString(), anyString()))
                .thenReturn(new MikoPbxRestClient.CreatedEmployee("42", "1900"));

        AsteriskProvisioningService svc = new AsteriskProvisioningService(mikoPbx, properties, m -> {});

        var result = svc.provisionExtension("1900", "Joaquín", "passwd-1900");

        assertThat(result.success()).isTrue();
        assertThat(result.attempts()).isEqualTo(1);
        assertThat(result.mikoPbxId()).isEqualTo("42");
        verify(mikoPbx, times(1)).createEmployee("1900", "Joaquín", "passwd-1900");
    }

    @Test
    void provision_retriesWithExponentialBackoff_thenSucceeds() {
        when(mikoPbx.createEmployee(anyString(), anyString(), anyString()))
                .thenThrow(new MikoPbxException("timeout"))
                .thenThrow(new MikoPbxException("timeout"))
                .thenReturn(new MikoPbxRestClient.CreatedEmployee("99", "1901"));
        List<Long> sleeps = new ArrayList<>();

        AsteriskProvisioningService svc = new AsteriskProvisioningService(mikoPbx, properties, sleeps::add);

        var result = svc.provisionExtension("1901", "X", "p");

        assertThat(result.success()).isTrue();
        assertThat(result.attempts()).isEqualTo(3);
        assertThat(result.mikoPbxId()).isEqualTo("99");
        // backoff exponencial: 100ms, 200ms (multiplier 2.0)
        assertThat(sleeps).containsExactly(100L, 200L);
    }

    @Test
    void provision_returnsFailedResult_whenAllAttemptsExhausted() {
        when(mikoPbx.createEmployee(anyString(), anyString(), anyString()))
                .thenThrow(new MikoPbxException("MikoPBX down"));
        List<Long> sleeps = new ArrayList<>();

        AsteriskProvisioningService svc = new AsteriskProvisioningService(mikoPbx, properties, sleeps::add);

        var result = svc.provisionExtension("1902", "X", "p");

        assertThat(result.success()).isFalse();
        assertThat(result.attempts()).isEqualTo(3);
        assertThat(result.mikoPbxId()).isNull();
        assertThat(result.error()).contains("down");
        // 3 intentos → 2 sleeps entre ellos
        assertThat(sleeps).hasSize(2);
    }
}
