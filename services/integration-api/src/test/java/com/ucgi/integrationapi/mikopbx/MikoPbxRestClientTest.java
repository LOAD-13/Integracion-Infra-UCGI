package com.ucgi.integrationapi.mikopbx;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.containing;
import static com.github.tomakehurst.wiremock.client.WireMock.delete;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.matchingJsonPath;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.github.tomakehurst.wiremock.junit5.WireMockRuntimeInfo;
import com.github.tomakehurst.wiremock.junit5.WireMockTest;
import java.net.http.HttpClient;
import java.time.Duration;
import org.junit.jupiter.api.Test;

@WireMockTest
class MikoPbxRestClientTest {

    private MikoPbxRestClient newClient(WireMockRuntimeInfo wm) {
        MikoPbxProperties props = new MikoPbxProperties(
                "127.0.0.1", wm.getHttpPort(), "admin", "secret", 1000, 2000,
                new MikoPbxProperties.Retry(3, 100, 2.0));
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1000))
                .version(HttpClient.Version.HTTP_1_1)
                .build();
        return new MikoPbxRestClient(props, http);
    }

    @Test
    void loginAndCreateEmployee_happyPath(WireMockRuntimeInfo wm) {
        stubLogin();
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                post(urlPathEqualTo("/pbxcore/api/v3/employees"))
                        .withHeader("Authorization", equalTo("Bearer test-jwt-token"))
                        .withRequestBody(matchingJsonPath("$.number"))
                        .withRequestBody(matchingJsonPath("$.sip_secret"))
                        .willReturn(aResponse().withStatus(201)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"result\":true,\"data\":{\"id\":\"42\",\"number\":\"1900\","
                                        + "\"user_username\":\"UCGI\"},\"messages\":[]}")));

        MikoPbxRestClient client = newClient(wm);
        var created = client.createEmployee("1900", "UCGI Agent", "passwd-1900");

        assertThat(created.id()).isEqualTo("42");
        assertThat(created.number()).isEqualTo("1900");
    }

    @Test
    void refreshesTokenOnlyOnce_acrossSeveralCalls(WireMockRuntimeInfo wm) {
        stubLogin();
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                post(urlPathEqualTo("/pbxcore/api/v3/employees"))
                        .willReturn(aResponse().withStatus(201)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"result\":true,\"data\":{\"id\":\"1\",\"number\":\"1\"}}")));

        MikoPbxRestClient client = newClient(wm);
        for (int i = 0; i < 5; i++) {
            client.createEmployee("190" + i, "X", "p");
        }

        com.github.tomakehurst.wiremock.client.WireMock.verify(1,
                com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor(
                        urlPathEqualTo("/pbxcore/api/v3/auth:login")));
        com.github.tomakehurst.wiremock.client.WireMock.verify(5,
                com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor(
                        urlPathEqualTo("/pbxcore/api/v3/employees")));
    }

    @Test
    void createEmployee_throwsMikoPbxException_whenResultFalse(WireMockRuntimeInfo wm) {
        stubLogin();
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                post(urlPathEqualTo("/pbxcore/api/v3/employees"))
                        .willReturn(aResponse().withStatus(400)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"result\":false,\"messages\":{\"error\":[\"duplicate number\"]}}")));

        MikoPbxRestClient client = newClient(wm);

        assertThatThrownBy(() -> client.createEmployee("1001", "X", "p"))
                .isInstanceOf(MikoPbxException.class);
    }

    @Test
    void createEmployee_throwsMikoPbxException_on5xx(WireMockRuntimeInfo wm) {
        stubLogin();
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                post(urlPathEqualTo("/pbxcore/api/v3/employees"))
                        .willReturn(aResponse().withStatus(503).withBody("upstream busy")));

        MikoPbxRestClient client = newClient(wm);

        assertThatThrownBy(() -> client.createEmployee("1001", "X", "p"))
                .isInstanceOf(MikoPbxException.class)
                .satisfies(ex -> assertThat(((MikoPbxException) ex).getStatusCode()).isEqualTo(503));
    }

    @Test
    void deleteEmployee_callsDeleteEndpoint(WireMockRuntimeInfo wm) {
        stubLogin();
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                delete(urlPathEqualTo("/pbxcore/api/v3/employees/42"))
                        .willReturn(aResponse().withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"result\":true,\"data\":{\"deleted_id\":\"42\"}}")));

        MikoPbxRestClient client = newClient(wm);
        client.deleteEmployee("42");

        com.github.tomakehurst.wiremock.client.WireMock.verify(1,
                com.github.tomakehurst.wiremock.client.WireMock.deleteRequestedFor(
                        urlPathEqualTo("/pbxcore/api/v3/employees/42")));
    }

    @Test
    void listExtensionNumbers_returnsAllNumbersFromData(WireMockRuntimeInfo wm) {
        stubLogin();
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                get(urlEqualTo("/pbxcore/api/v3/extensions"))
                        .willReturn(aResponse().withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"result\":true,\"data\":["
                                        + "{\"id\":\"1\",\"number\":\"1001\",\"type\":\"SIP\"},"
                                        + "{\"id\":\"2\",\"number\":\"1002\",\"type\":\"SIP\"},"
                                        + "{\"id\":\"3\",\"number\":\"201\",\"type\":\"SIP\"}]}")));

        MikoPbxRestClient client = newClient(wm);
        var nums = client.listExtensionNumbers();

        assertThat(nums).containsExactlyInAnyOrder("1001", "1002", "201");
    }

    @Test
    void ping_returnsTrue_whenSystemPingPongsBack(WireMockRuntimeInfo wm) {
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                get(urlEqualTo("/pbxcore/api/system/ping"))
                        .willReturn(aResponse().withStatus(200).withBody("PONG")));

        MikoPbxRestClient client = newClient(wm);

        assertThat(client.ping()).isTrue();
    }

    @Test
    void ping_returnsFalse_onConnectionError() {
        // puerto 1 — siempre rechazado en cualquier host sano
        MikoPbxProperties props = new MikoPbxProperties(
                "127.0.0.1", 1, "admin", "secret", 200, 200,
                new MikoPbxProperties.Retry(1, 100, 2.0));
        MikoPbxRestClient client = new MikoPbxRestClient(props,
                HttpClient.newBuilder().connectTimeout(Duration.ofMillis(200))
                        .version(HttpClient.Version.HTTP_1_1).build());

        assertThat(client.ping()).isFalse();
    }

    private static void stubLogin() {
        com.github.tomakehurst.wiremock.client.WireMock.stubFor(
                post(urlPathEqualTo("/pbxcore/api/v3/auth:login"))
                        .withRequestBody(containing("admin"))
                        .willReturn(aResponse().withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"result\":true,\"data\":{"
                                        + "\"accessToken\":\"test-jwt-token\","
                                        + "\"tokenType\":\"Bearer\","
                                        + "\"expiresIn\":900,"
                                        + "\"login\":\"admin\"}}")));
    }
}
