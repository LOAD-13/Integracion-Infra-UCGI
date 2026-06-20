/*
 * TestREST.groovy — invocado por Test Connection desde la UI.
 * Verifica que /actuator/health del integration-api responde 200.
 */
import groovyx.net.http.RESTClient

def client = new RESTClient(connection.serviceAddress)
def resp = client.get(path: "/actuator/health")
assert resp.status == 200 : "Healthcheck del integration-api respondió ${resp.status}"
assert resp.data?.status == "UP" : "integration-api no está UP: ${resp.data?.status}"
log.info("TestREST OK — integration-api UP")
