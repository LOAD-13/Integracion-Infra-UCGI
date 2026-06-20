/*
 * UpdateREST.groovy — actualización de displayName/sipPassword de una extensión.
 * El integration-api expone PUT /api/v1/sip-extensions/{number} (HU-05.x futuro).
 * Para el lab actual aceptamos noop si el endpoint no existe todavía.
 */
import groovyx.net.http.RESTClient
import groovyx.net.http.HttpResponseException
import static groovyx.net.http.ContentType.JSON

def jwt = ::authenticate(connection)
def client = new RESTClient(connection.serviceAddress)
client.headers["Authorization"] = "Bearer ${jwt}"

def patch = [:]
attributes.each { a ->
    if (a.name == "displayName") patch.displayName = a.value[0]
    if (a.name == "sipPassword") patch.sipPassword = a.value[0]
}

try {
    client.put(
        path: "/api/v1/sip-extensions/${uid.uidValue}",
        contentType: JSON,
        body: patch
    )
    log.info("UpdateREST 200 — extension=${uid.uidValue}")
    return uid.uidValue
} catch (HttpResponseException e) {
    if (e.response.status == 404 || e.response.status == 405) {
        log.warn("UpdateREST noop — PUT no implementado todavía (status ${e.response.status})")
        return uid.uidValue
    }
    log.error("UpdateREST ${e.response.status} — ${e.message}")
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
