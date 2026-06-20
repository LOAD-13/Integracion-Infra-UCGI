/*
 * SearchREST.groovy — listado de extensiones existentes.
 * Soporta __NAME__ search (extensionNumber) y "no filter" (todos).
 */
import groovyx.net.http.RESTClient
import static groovyx.net.http.ContentType.JSON

def jwt = ::authenticate(connection)
def client = new RESTClient(connection.serviceAddress)
client.headers["Authorization"] = "Bearer ${jwt}"

def resp = client.get(path: "/api/v1/sip-extensions", contentType: JSON)
resp.data.each { ext ->
    def cob = new ConnectorObjectBuilder()
    cob.setUid(ext.extensionNumber as String)
    cob.setName(ext.username as String)
    cob.addAttribute("extensionNumber", ext.extensionNumber)
    cob.addAttribute("displayName", ext.displayName)
    handler(cob.build())
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
