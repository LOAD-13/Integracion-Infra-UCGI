# Hallazgos técnicos — arranque Sprint 3 (2026-06-18)

> Notas internas del equipo. Cada punto documenta un detalle no evidente que apareció implementando EP-03 (microservicio `integration-api`) y que conviene tener registrado para futuras integraciones, revisiones de PR y la defensa del proyecto.

## 1. El bit ejecutable se pierde al editar desde Windows

Al hacer el primer push del Maven Wrapper (HU-03.1, PR #8), CI falló en ~5 s con `./mvnw: Permission denied` (exit code 126).

**Causa raíz:** en Windows `git` tiene `core.fileMode=false` por defecto. Aunque `chmod +x mvnw` se ejecute desde WSL, el bit no se persiste en el index si el repo se accede vía el bind `\\wsl.localhost\...` desde herramientas Windows.

**Detección preventiva:**

```bash
git ls-files --stage services/integration-api/mvnw
# 100755 = ejecutable | 100644 = no ejecutable
```

**Solución:** forzar el modo en el index sin alterar el filesystem.

```bash
git update-index --chmod=+x services/integration-api/mvnw
git commit -m "fix(api): marcar mvnw como ejecutable [IUDCYGI-19]"
```

**Aplicable a:** wrappers (`mvnw`, `gradlew`), scripts `*.sh`, hooks de git versionados, binarios sin shebang dependientes del `+x`.

**Política:** cuando un PR añada un wrapper o script ejecutable, validar antes del primer push con `git ls-files --stage <ruta>`.

---

## 2. `.gitignore` de directorio bloquea las excepciones de su contenido

Tras añadir el Maven Wrapper, `git add` se saltaba el archivo `.mvn/wrapper/maven-wrapper.properties`. `git status` no lo mostraba ni como untracked.

**Causa raíz:** el `.gitignore` raíz tenía:

```gitignore
.mvn/
!.mvn/wrapper/maven-wrapper.properties
```

Git **no desciende** en directorios ignorados. La regla negativa (`!`) solo se aplica si Git visita el archivo, lo cual no ocurre cuando el padre está cubierto por un patrón positivo.

**Detección:**

```bash
git check-ignore -v services/integration-api/.mvn/wrapper/maven-wrapper.properties
# muestra qué regla y qué .gitignore están ignorando el archivo
```

**Solución:** ignorar el archivo específico, no el directorio padre.

```gitignore
# Antes (no funciona)
.mvn/
!.mvn/wrapper/maven-wrapper.properties

# Después (correcto)
.mvn/wrapper/maven-wrapper.jar
```

**Aplicable también a** `.idea/` con excepciones para `.idea/runConfigurations/`, `.gradle/` con excepciones para `gradle-wrapper.properties`, cualquier patrón `dir/ + !dir/sub/file`.

---

## 3. `@TransactionalEventListener(AFTER_COMMIT)` para side-effects fuera de la transacción

`POST /api/v1/sip-extensions` debe orquestar tres efectos: persistir en BD, regenerar `pjsip-dynamic.conf` y disparar `pjsip reload` por AMI. Si el reload ocurriera dentro del método `@Transactional`, un rollback tardío dejaría a Asterisk creyendo que la extensión existe cuando la BD ya la descartó.

**Patrón correcto** (implementado en `SipExtensionService`):

```java
@Transactional
public SipExtensionResponse create(SipExtensionCreateRequest request) {
    SipExtension saved = sipExtensionRepository.save(...);
    events.publishEvent(new SipExtensionPersistedEvent(saved.getExtensionNumber()));
    return SipExtensionResponse.of(saved, user.getUsername());
}

@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
void onPersisted(SipExtensionPersistedEvent event) {
    provisioningService.provision();
}
```

**Garantías que aporta:**

| Escenario | Comportamiento |
| --- | --- |
| BD commitea correctamente | AMI reload + writeTo ejecutan. |
| BD rollback (constraint, deadlock, etc.) | El evento se descarta, AMI no se contacta. |
| AMI falla tras los reintentos | No propaga al cliente HTTP. La persistencia es la fuente de verdad y el reload se reintentará en el próximo trigger. |

**Por qué no `@EventListener` simple:** corre síncronamente dentro de la transacción y pierde la garantía de "solo si commiteó".

Es un mecanismo estándar de `spring-tx` y cubre el control "Fiabilidad — Tolerancia a fallos" del modelo ISO/IEC 25010 que el proyecto se compromete a evidenciar.

---

## 4. `#tryinclude` en Asterisk para volúmenes compartidos al primer arranque

La arquitectura provisional para EP-03 usa un named volume `asterisk-dynamic` montado en `/etc/asterisk/dynamic.d/` tanto en `asterisk` como en `integration-api`. El microservicio escribe `pjsip.conf` ahí y Asterisk lo incluye desde el `pjsip.conf` baked.

**Trampa:** en el primer `docker compose up`, el volumen está vacío. Un `#include "dynamic.d/pjsip.conf"` haría fallar el arranque de Asterisk porque el archivo no existe.

**Solución:** usar la directiva `#tryinclude`.

```ini
; infra/asterisk/configs/pjsip.conf (baked)
...
#tryinclude "dynamic.d/pjsip.conf"
```

`#tryinclude` no falla si el archivo no existe: simplemente lo omite. Asterisk arranca sin endpoints; el primer `POST /api/v1/sip-extensions` crea el archivo y el `pjsip reload` posterior lo carga.

**Aplicable también** a includes opcionales por entorno (`#tryinclude "env-overrides.conf"`), configuración generada por orquestadores externos, perfiles `dev`/`prod` que comparten misma base.

---

## 5. `asterisk-java` 3.39 — manejo real de excepciones

Al implementar `AsteriskAmiClient`, intuitivamente se esperaría que `ManagerConnection.sendAction(...)` lanzara `InterruptedException` por tener un timeout. No es así.

**API real de `org.asteriskjava.manager.ManagerConnection` 3.39:**

| Método | Excepciones realmente lanzadas |
| --- | --- |
| `login()` | `IOException`, `AuthenticationFailedException`, `TimeoutException` |
| `sendAction(action, timeout)` | `IOException`, `TimeoutException` |
| `logoff()` | sin excepciones chequeadas |

La librería implementa los timeouts con NIO no-bloqueante (`select()`/`poll()`), no con `Thread.sleep()`. Por eso `InterruptedException` no es parte del contrato público.

**Implicación práctica:** capturar `IOException + AuthenticationFailedException + TimeoutException` cubre el universo de fallos del cliente. Cualquier catch adicional de `InterruptedException` falla la compilación (lo que es deseable: el compilador nos protege de un mental model erróneo).

**Política:** cuando se integre una librería externa, antes de escribir el `try/catch` revisar la signatura real y no asumir el conjunto de excepciones por convención del lenguaje.

---

## Comandos de referencia rápida

```bash
# Forzar bit ejecutable en git index (sin tocar FS)
git update-index --chmod=+x <archivo>

# Ver qué regla del .gitignore ignora un archivo
git check-ignore -v <ruta>

# Ver el modo de un archivo en el index
git ls-files --stage <archivo>

# Compilar y ejecutar tests Maven sin instalar Java/Maven en el host
docker run --rm \
  -v "$PWD":/workspace -w /workspace/services/integration-api \
  -v maven-cache:/root/.m2 \
  maven:3.9-eclipse-temurin-17 \
  mvn -B verify

# Validar sintaxis de configs Asterisk sin arrancar el daemon
asterisk -T
```
