package com.ucgi.integrationapi.asterisk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ucgi.integrationapi.pjsip.PjsipConfigWriter;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class AsteriskProvisioningServiceTest {

    private final PjsipConfigWriter writer = mock(PjsipConfigWriter.class);
    private final AsteriskAmiClient amiClient = mock(AsteriskAmiClient.class);
    private final AsteriskProperties properties = new AsteriskProperties(
            new AsteriskProperties.Ami("asterisk", 5038, "u", "s", 5000),
            "/etc/asterisk/dynamic.d/pjsip.conf",
            new AsteriskProperties.Reload(3, 100, 2.0));

    @Test
    void provision_writesConfThenReloads_onHappyPath() {
        when(writer.writeTo(any(Path.class))).thenReturn(Path.of("/etc/asterisk/dynamic.d/pjsip.conf"));
        when(amiClient.pjsipReload()).thenReturn("Success");

        AsteriskProvisioningService svc = new AsteriskProvisioningService(
                writer, amiClient, properties, millis -> {});

        var result = svc.provision();

        assertThat(result.reloaded()).isTrue();
        assertThat(result.attempts()).isEqualTo(1);
        verify(writer, times(1)).writeTo(Path.of("/etc/asterisk/dynamic.d/pjsip.conf"));
        verify(amiClient, times(1)).pjsipReload();
    }

    @Test
    void provision_retriesWithExponentialBackoff_thenSucceeds() {
        when(writer.writeTo(any(Path.class))).thenReturn(Path.of("/etc/asterisk/dynamic.d/pjsip.conf"));
        when(amiClient.pjsipReload())
                .thenThrow(new AsteriskAmiClient.AmiException("timeout"))
                .thenThrow(new AsteriskAmiClient.AmiException("timeout"))
                .thenReturn("Success");
        List<Long> sleeps = new ArrayList<>();

        AsteriskProvisioningService svc = new AsteriskProvisioningService(
                writer, amiClient, properties, sleeps::add);

        var result = svc.provision();

        assertThat(result.reloaded()).isTrue();
        assertThat(result.attempts()).isEqualTo(3);
        // backoff exponencial: 100ms, 200ms (multiplier 2.0)
        assertThat(sleeps).containsExactly(100L, 200L);
    }

    @Test
    void provision_returnsFailedResult_whenAllAttemptsExhausted() {
        when(writer.writeTo(any(Path.class))).thenReturn(Path.of("/etc/asterisk/dynamic.d/pjsip.conf"));
        when(amiClient.pjsipReload())
                .thenThrow(new AsteriskAmiClient.AmiException("down"));
        List<Long> sleeps = new ArrayList<>();

        AsteriskProvisioningService svc = new AsteriskProvisioningService(
                writer, amiClient, properties, sleeps::add);

        var result = svc.provision();

        assertThat(result.reloaded()).isFalse();
        assertThat(result.attempts()).isEqualTo(3);
        assertThat(result.error()).contains("down");
        // 3 intentos → 2 sleeps entre ellos
        assertThat(sleeps).hasSize(2);
    }
}
