/*
 * CreateREST.groovy
 * --------------------------------------------------------------------------
 * Crea una extensión SIP en MikoPBX a través del integration-api.
 *
 * Variables disponibles (inyectadas por ScriptedREST connector):
 *   - connection : ScriptedRESTConfiguration con serviceAddress.
 *   - operation  : "CREATE".
 *   - objectClass: __ACCOUNT__.
 *   - attributes : Set<Attribute> con los outbound mappings del resource XML.
 *   - log        : SLF4J logger del conector.
 *
 * Contrato del integration-api (HU-03.2 / HU-03.8):
 *   POST /api/v1/sip-extensions
 *   Authorization: Bearer <JWT>
 *   Content-Type: application/json
 *   { "username":"...", "displayName":"...", "extensionNumber":"1900", "sipPassword":"..." }
 *
 *   200/201 → { "id":1, ... }       — extensión creada
 *   409     → ya existe             — la extensión se considera idempotente
 *   401/403 → JWT inválido/expirado → relogin y reintento
 */
import groovyx.net.http.RESTClient
import groovyx.net.http.HttpResponseException
import static groovyx.net.http.ContentType.JSON

def attrs = [:]
attributes.each { attr ->
    if (attr.name == "__NAME__")        attrs.username        = attr.value[0]
    if (attr.name == "username")        attrs.username        = attr.value[0]
    if (attr.name == "displayName")     attrs.displayName     = attr.value[0]
    if (attr.name == "extensionNumber") attrs.extensionNumber = attr.value[0]
    if (attr.name == "sipPassword")     attrs.sipPassword     = attr.value[0]
}

assert attrs.username        != null : "username es obligatorio para crear la extensión SIP"
assert attrs.extensionNumber != null : "extensionNumber debe venir del outbound mapping"
assert attrs.sipPassword     != null : "sipPassword debe venir del outbound mapping"

def jwt = ::authenticate(connection)
def client = new RESTClient(connection.serviceAddress)
client.headers["Authorization"] = "Bearer ${jwt}"

try {
    def resp = client.post(
        path: "/api/v1/sip-extensions",
        contentType: JSON,
        body: attrs
    )
    log.info("CreateREST 2xx — extension=${attrs.extensionNumber} username=${attrs.username}")
    return attrs.extensionNumber as String
} catch (HttpResponseException e) {
    if (e.response.status == 409) {
        log.warn("CreateREST 409 idempotente — extension=${attrs.extensionNumber} ya existe, no fallo")
        return attrs.extensionNumber as String
    }
    log.error("CreateREST ${e.response.status} — ${e.message}")
    throw e
}

/**
 * Obtiene un Bearer JWT del integration-api usando user/pass técnico del
 * resource configuration. En producción se cachearía con TTL — para el lab
 * basta con renovar en cada llamada.
 */
def authenticate(cfg) {
    def authClient = new RESTClient(cfg.serviceAddress)
    def resp = authClient.post(
        path: "/api/v1/auth/login",
        contentType: JSON,
        body: [username: cfg.username, password: cfg.password.toString()]
    )
    return resp.data.accessToken
}
