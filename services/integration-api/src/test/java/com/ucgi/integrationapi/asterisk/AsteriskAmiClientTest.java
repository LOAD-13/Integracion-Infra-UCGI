package com.ucgi.integrationapi.asterisk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.asteriskjava.manager.AuthenticationFailedException;
import org.asteriskjava.manager.ManagerConnection;
import org.asteriskjava.manager.action.ManagerAction;
import org.asteriskjava.manager.response.ManagerResponse;
import org.junit.jupiter.api.Test;

class AsteriskAmiClientTest {

    private final AsteriskProperties properties = new AsteriskProperties(
            new AsteriskProperties.Ami("asterisk", 5038, "ucgi-ami", "changeme-ami", 5000),
            "/etc/asterisk/dynamic.d/pjsip.conf",
            new AsteriskProperties.Reload(3, 100, 2.0));

    @Test
    void executesCommand_loginThenSendThenLogoff() throws Exception {
        ManagerConnection conn = mock(ManagerConnection.class);
        ManagerResponse response = mock(ManagerResponse.class);
        when(response.getResponse()).thenReturn("Success");
        when(conn.sendAction(any(ManagerAction.class), anyLong())).thenReturn(response);

        AsteriskAmiClient client = new AsteriskAmiClient(properties, ami -> conn);

        String result = client.executeCommand("pjsip reload");

        assertThat(result).isEqualTo("Success");
        verify(conn, times(1)).login();
        verify(conn, times(1)).sendAction(any(ManagerAction.class), anyLong());
        verify(conn, times(1)).logoff();
    }

    @Test
    void throwsAmiException_whenResponseIsError() throws Exception {
        ManagerConnection conn = mock(ManagerConnection.class);
        ManagerResponse response = mock(ManagerResponse.class);
        when(response.getResponse()).thenReturn("Error");
        when(response.getMessage()).thenReturn("Module not loaded");
        when(conn.sendAction(any(ManagerAction.class), anyLong())).thenReturn(response);

        AsteriskAmiClient client = new AsteriskAmiClient(properties, ami -> conn);

        assertThatThrownBy(() -> client.executeCommand("pjsip reload"))
                .isInstanceOf(AsteriskAmiClient.AmiException.class)
                .hasMessageContaining("Module not loaded");
        verify(conn).logoff();
    }

    @Test
    void throwsAmiException_whenAuthFails() throws Exception {
        ManagerConnection conn = mock(ManagerConnection.class);
        org.mockito.Mockito.doThrow(new AuthenticationFailedException("bad secret"))
                .when(conn).login();

        AsteriskAmiClient client = new AsteriskAmiClient(properties, ami -> conn);

        assertThatThrownBy(() -> client.executeCommand("pjsip reload"))
                .isInstanceOf(AsteriskAmiClient.AmiException.class)
                .hasMessageContaining("auth");
        verify(conn).logoff();
    }

    @Test
    void pjsipReload_delegatesToExecuteCommandWithCorrectVerb() throws Exception {
        ManagerConnection conn = mock(ManagerConnection.class);
        ManagerResponse response = mock(ManagerResponse.class);
        when(response.getResponse()).thenReturn("Success");
        when(conn.sendAction(any(ManagerAction.class), anyLong())).thenReturn(response);

        AsteriskAmiClient client = new AsteriskAmiClient(properties, ami -> conn);

        client.pjsipReload();

        org.mockito.ArgumentCaptor<ManagerAction> captor =
                org.mockito.ArgumentCaptor.forClass(ManagerAction.class);
        verify(conn).sendAction(captor.capture(), anyLong());
        org.asteriskjava.manager.action.CommandAction sent =
                (org.asteriskjava.manager.action.CommandAction) captor.getValue();
        assertThat(sent.getCommand()).isEqualTo("pjsip reload");
    }
}
