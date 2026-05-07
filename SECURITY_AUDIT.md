# SECURITY_AUDIT.md — Ledger

**Fecha:** 2026-05-07  
**Alcance:** Backend (FastAPI), Frontend (Next.js), Android (Kotlin/Compose), Bot (Telegram), infraestructura Docker  
**Metodología:** Revisión estática de código fuente + análisis de flujo de datos. Sin acceso a instancia en ejecución.  
**Nota:** Los hallazgos se han filtrado con agentes independientes de eliminación de falsos positivos. Solo se reportan vulnerabilidades con confianza ≥ 8/10.

---

## 1. Hallazgos Críticos

> Vulnerabilidades explotables que requieren acción inmediata.

---

### SEC-01 · SSRF vía `paperless_url` configurable por el usuario `[FIXED]`

- **Severidad:** ALTA  
- **Confianza:** 8/10  
- **Categoría:** Server-Side Request Forgery (SSRF)  
- **Fix aplicado:** `_validate_paperless_url()` en `backend/app/routers/settings.py` — bloquea esquemas no-http/https, hosts en `_BLOCKED_HOSTS` y rangos `127.0.0.0/8` + `169.254.0.0/16`. Validación en `PUT /api/settings` y defense-in-depth en `POST /api/settings/verify-paperless`. Tests en `backend/tests/test_settings.py`.  
- **Archivos afectados:**  
  - `backend/app/routers/settings.py:20-47` (endpoint PUT, sin validación de URL)  
  - `backend/app/routers/settings.py:50-75` (endpoint POST `/verify-paperless`, dispara la petición)  
  - `backend/app/services/paperless_service.py:97-111, 121-224, 226-241, 244-259` (usa la URL sin restricción)

**Descripción del problema:**

El endpoint `PUT /api/settings` acepta cualquier valor de cadena para la clave `paperless_url` sin validar el esquema, el host ni el puerto. El schema `SettingUpsert` tampoco impone restricciones:

```python
# backend/app/routers/settings.py:20-22
class SettingUpsert(BaseModel):
    key: str
    value: str | None = None   # sin validadores — acepta cualquier cadena
```

El endpoint `POST /api/settings/verify-paperless` lee esa URL y la usa directamente en una petición HTTP:

```python
# backend/app/routers/settings.py:64-74
async with httpx.AsyncClient(timeout=10.0) as client:
    resp = await client.get(
        f"{url.rstrip('/')}/api/documents/",   # url es input del atacante
        params={"page_size": 1},
        headers={"Authorization": f"Token {token}"},
    )
if resp.status_code == 200:
    return PaperlessVerifyResult(ok=True)
return PaperlessVerifyResult(ok=False, error=f"HTTP {resp.status_code}")  # status code filtrado
```

El mismo patrón se repite en `paperless_service.py` para uploads, downloads y deletes.

**Escenario de explotación:**

1. Atacante autenticado llama `PUT /api/settings` con `{"key": "paperless_url", "value": "http://169.254.169.254"}` (AWS metadata).
2. Llama `POST /api/settings/verify-paperless`.
3. El backend hace GET a `http://169.254.169.254/api/documents/?page_size=1`.
4. La respuesta filtra el código HTTP. Con timing o prueba de puertos el atacante determina qué servicios internos son accesibles.
5. Repite con `http://localhost:5433` (PostgreSQL), `http://192.168.1.x:8010` (Paperless), etc.

La respuesta en sí (solo código HTTP + error string) limita la exfiltración de datos, pero permite **enumeración de red interna** y **detección de servicios** desde el servidor backend, que tiene acceso a la red del NAS y del LXC.

**Fix recomendado:**

```python
# backend/app/schemas/settings.py (nuevo archivo o en schemas existente)
from pydantic import AnyHttpUrl, field_validator
import ipaddress

BLOCKED_HOSTS = {
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "169.254.169.254",  # AWS/GCP metadata
    "metadata.google.internal",
}

class PaperlessUrlStr(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v: str) -> str:
        from urllib.parse import urlparse
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("Solo se permiten esquemas http/https")
        host = parsed.hostname or ""
        if host.lower() in BLOCKED_HOSTS:
            raise ValueError("Host no permitido")
        try:
            addr = ipaddress.ip_address(host)
            if addr.is_loopback or addr.is_link_local:
                raise ValueError("IPs de loopback/link-local no permitidas")
        except ValueError:
            pass  # es un hostname, no IP — aceptable
        return v

class SettingUpsert(BaseModel):
    key: str
    value: str | None = None

    @field_validator("value")
    @classmethod
    def validate_url_if_paperless(cls, v, info):
        if info.data.get("key") == "paperless_url" and v is not None:
            PaperlessUrlStr.validate(v)
        return v
```

Aplicar también en `paperless_service.py` antes de cada llamada a `httpx`.

---

## 2. Hallazgos Importantes

> Riesgos significativos a corregir en el corto plazo.

---

### SEC-02 · Credenciales de Paperless devueltas en texto claro por `GET /api/settings` `[FIXED]`

- **Severidad:** MEDIA-ALTA  
- **Confianza:** 9/10  
- **Categoría:** Credential Exposure / Escalada de privilegios laterales  
- **Fix aplicado:** `GET /api/settings` devuelve `"***"` si hay token, `null` si no. `PUT /api/settings` ignora el valor `"***"` (placeholder) para no sobreescribir el token real. Frontend actualizado para mostrar placeholder informativo y no enviar token vacío cuando ya hay uno configurado.  
- **Archivos afectados:**  
  - `backend/app/routers/settings.py:30-36`

**Descripción del problema:**

El endpoint `GET /api/settings` devuelve el `paperless_token` en texto claro a cualquier usuario autenticado:

```python
# backend/app/routers/settings.py:30-36
@router.get("", response_model=dict[str, str | None])
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await settings_service.get_all(db, current_user.id)
    return {key: data.get(key) for key in _KNOWN_KEYS}   # devuelve paperless_token en claro
```

En una instalación real, el `paperless_token` es el token de administrador de la instancia Paperless-ngx. Paperless-ngx no implementa aislamiento per-user de documentos por defecto — con ese token se puede listar, leer, modificar y borrar **todos** los documentos de la instancia, incluidos los de otros usuarios si la instalación es compartida.

Esto significa que:
- Un atacante que comprometa la sesión JWT de cualquier usuario obtiene automáticamente las credenciales de Paperless.
- Si el token de Paperless es un token de superusuario (el habitual en self-hosted), el atacante puede acceder a todos los recibos almacenados.

**Impacto agravante:** La credencial `paperless_token` se filtra también en logs vía el campo `headers={"Authorization": f"Token {token}"}` en llamadas que loguean la URL completa (`paperless_service.py:232`).

**Fix recomendado:**

```python
# Opción A: No devolver el token en GET — solo confirmar si está configurado
@router.get("", response_model=dict[str, str | None])
async def get_settings(...):
    data = await settings_service.get_all(db, current_user.id)
    return {
        "paperless_url": data.get("paperless_url"),
        "paperless_token": "***" if data.get("paperless_token") else None,
    }

# Opción B: Endpoint separado solo-escritura para el token
# Solo aceptar PUT/PATCH para el token; GET siempre devuelve None o mascara
```

---

### SEC-03 · Android — tráfico HTTP en texto claro habilitado globalmente `[FIXED]`

- **Severidad:** MEDIA  
- **Confianza:** 9/10  
- **Categoría:** Transmisión insegura de credenciales (CWE-319)  
- **Fix aplicado:** Creado `android/app/src/main/res/xml/network_security_config.xml` que restringe cleartext a `192.168.1.125` y rangos de emulador en debug-overrides. `AndroidManifest.xml` usa `android:networkSecurityConfig` en lugar de `android:usesCleartextTraffic="true"`. Build debug: `BUILD SUCCESSFUL`.  
- **Archivos afectados:**  
  - `android/app/src/main/AndroidManifest.xml:24`  
  - `android/app/src/main/res/xml/` (ausencia de `network_security_config.xml`)

**Descripción del problema:**

```xml
<!-- android/app/src/main/AndroidManifest.xml:24 -->
android:usesCleartextTraffic="true"
```

Esta directiva permite HTTP sin cifrar en **todo el tráfico de la aplicación**, sin restricción por dominio o rango IP. No existe `network_security_config.xml` que limite el cleartext a redes privadas.

La aplicación configura la URL del servidor en tiempo de ejecución via `DynamicUrlInterceptor`. Si un usuario configura una URL de servidor con `http://` apuntando a un host no-LAN (o si el dispositivo está en WiFi no confiable), todas las credenciales (tokens JWT, refresh tokens, datos de gastos) se transmiten en texto claro.

**Escenario de explotación:**
1. Usuario conecta el móvil a una WiFi de hotel/aeropuerto.
2. Atacante en la misma red realiza ARP spoofing o es el propio AP.
3. Captura las peticiones HTTP con Wireshark o mitmproxy.
4. Obtiene el JWT de acceso y el refresh token del usuario.
5. Suplanta al usuario accediendo a todos sus viajes y gastos.

**Fix recomendado:**

Crear `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Cleartext solo permitido en IPs privadas/LAN -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">10.0.0.0/8</domain>
        <domain includeSubdomains="true">192.168.0.0/16</domain>
        <domain includeSubdomains="true">172.16.0.0/12</domain>
    </domain-config>
    <!-- HTTPS obligatorio para todo lo demás -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config>
```

Reemplazar en `AndroidManifest.xml`:
```xml
<!-- Quitar: android:usesCleartextTraffic="true" -->
<!-- Añadir: -->
android:networkSecurityConfig="@xml/network_security_config"
```

---

## 3. Hallazgos Menores

> Mejoras de defensa en profundidad. No explotables de forma directa.

---

### SEC-04 · `verify_bot_request` definida pero no usada en ningún router — *pendiente*

- **Severidad:** BAJA  
- **Confianza:** 8/10  
- **Categoría:** Dead code / seguridad futura  
- **Archivos afectados:**  
  - `backend/app/core/dependencies.py:48-81`  
  - `backend/app/routers/bot.py`

**Descripción:** La dependencia `verify_bot_request` implementa HMAC-SHA256 con ventana anti-replay de 5 minutos (correcta), pero ningún router actual la usa como `Depends(...)`. Si se añaden nuevos endpoints de bot sin leer la dependencia existente, podrían crearse endpoints bot no autenticados.

**Recomendación:** Documentar explícitamente en el router que cualquier endpoint `/api/bot/*` debe usar `Depends(verify_bot_request)`, o añadir un test que falle si existe algún endpoint `/api/bot/*` sin esa dependencia.

---

### SEC-05 · Logs incluyen URL de Paperless completa (incluyendo IP interna) `[FIXED]`

- **Severidad:** BAJA  
- **Confianza:** 8/10  
- **Fix aplicado:** `verify_paperless failed` en `settings.py:74` ya no incluye la URL. `paperless_service.py` download log elimina la URL completa (solo `doc_id`).  
- **Categoría:** Información sensible en logs  
- **Archivos afectados:**  
  - `backend/app/services/paperless_service.py:110, 232`

**Descripción:** Las líneas de log incluyen la URL completa de Paperless, que expone la IP interna del NAS y el puerto en los logs:

```python
# paperless_service.py:110
logger.warning("paperless_connection_failed url=%s error=%s", url, exc)
# paperless_service.py:232
logger.info("Paperless download — doc_id=%s url=%s", doc_id, url)
```

Si los logs son recolectados por un sistema externo (Datadog, ELK, Loki), la IP interna y el puerto del NAS son visibles para cualquiera con acceso a los logs.

**Recomendación:** Loguear solo el `doc_id` y el código de estado; omitir la URL base.

---

## 4. Bien Implementado

Los siguientes aspectos están correctamente securizados:

| Área | Implementación | Referencia |
|------|---------------|------------|
| **Autorización en endpoints** | Todos los endpoints de expenses y trips comprueban `user_id` en la cláusula WHERE, no solo el ID del recurso. Un usuario no puede acceder a recursos de otro aunque conozca el UUID. | `expense_service.py:89-96`, `trip_service.py:44-51` |
| **JWT — algoritmo fijo** | El algoritmo es `HS256` hardcodeado en config; `jwt.decode()` recibe `algorithms=[settings.ALGORITHM]`, bloqueando ataques de algorithm confusion (none/RS256→HS256). | `backend/app/core/security.py:38` |
| **JWT — tipo de token validado** | Los refresh tokens no pueden usarse como access tokens: se comprueba el campo `"type"` en el payload. | `backend/app/routers/auth.py:94-95` |
| **CORS — orígenes explícitos** | La configuración CORS usa lista explícita de orígenes sin wildcards ni regex. Correctamente leída de variable de entorno. | `backend/app/main.py:42-49` |
| **Validación MIME de uploads** | Los uploads de recibos validan magic bytes del fichero (no la extensión): JPEG, PNG, WebP y PDF. | `backend/app/routers/receipts.py:25-36` |
| **Bot auth — HMAC-SHA256 + anti-replay** | La dependencia `verify_bot_request` implementa firma HMAC-SHA256 con ventana temporal de 5 minutos y `hmac.compare_digest()` para comparación segura. | `backend/app/core/dependencies.py:48-81` |
| **Contraseñas — bcrypt** | Hashing con bcrypt, nunca se expone `password_hash` en los schemas de respuesta. | `backend/app/core/security.py` |
| **SECRET_KEY — mínimo 32 caracteres** | Validación en config que rechaza claves cortas. | `backend/app/config.py:37-41` |
| **Android — no hardcode de URL base** | `DynamicUrlInterceptor` lee la URL del servidor de `ConfigStore`; si no hay URL navega a `ConfigScreen` en lugar de usar localhost como fallback. | `AppModule.kt` |

---

## 5. Plan de Remediación

Ordenado por prioridad descendente:

| Prioridad | ID | Acción | Estado |
|-----------|-----|--------|--------|
| 🔴 1 | SEC-01 | Validación SSRF en `paperless_url` | ✅ FIXED |
| 🔴 2 | SEC-02 | Enmascarar `paperless_token` en GET settings | ✅ FIXED |
| 🟡 3 | SEC-03 | `network_security_config.xml` Android | ✅ FIXED |
| 🟢 4 | SEC-04 | Garantizar `verify_bot_request` en endpoints `/api/bot/*` | ⏳ Pendiente (A8) |
| 🟢 5 | SEC-05 | Eliminar URL de logs de Paperless | ✅ FIXED |
| ➕ extra | — | Dockerfile non-root user (uid 1001) | ✅ FIXED |
| ➕ extra | — | Backend `expose` en lugar de `ports` en docker-compose.yml | ✅ FIXED |

---

*Revisión realizada con análisis estático multi-agente. Se recomienda revisión dinámica (pentest) antes del lanzamiento a usuarios no confiables.*
