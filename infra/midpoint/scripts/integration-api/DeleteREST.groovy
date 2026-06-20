/*
 * DeleteREST.groovy
 * --------------------------------------------------------------------------
 * Borra una extensión SIP del integration-api / MikoPBX.
 *
 * Variables inyectadas: connection, operation, objectClass, uid, log.
 * El uid coincide con el extensionNumber (ver mapping en resource XML).
 */
import groovyx.net.http.RESTClient
import groovyx.net.http.HttpResponseException
import static groovyx.net.http.ContentType.JSON

def jwt = ::authenticate(connection)
def client = new RESTClient(connection.serviceAddress)
client.headers["Authorization"] = "Bearer ${jwt}"

try {
    client.delete(path: "/api/v1/sip-extensions/${uid.uidValue}")
    log.info("DeleteREST 204 — extension=${uid.uidValue}")
} catch (HttpResponseException e) {
    if (e.response.status == 404) {
        log.warn("DeleteREST 404 idempotente — extension=${uid.uidValue} ya estaba borrada")
        return
    }
    log.error("DeleteREST ${e.response.status} — ${e.message}")
    throw e
}

def authenticate(cfg) {
    def authClient = new RESTClient(cfg.serviceAddress)
    def resp = authClient.post(
        path: "/api/v1/auth/login",
        contentType: JSON,
        body: [username: cfg.username, password: cfg.password.toString()]
    )
    return resp.data.accessToken
}
