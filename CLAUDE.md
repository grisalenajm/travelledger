# CLAUDE.md — Guía de Arquitectura Ledger

> Documento de referencia para todos los agentes Claude Code.
> Leer completo antes de tocar cualquier fichero del proyecto.
> Si algo en tu tarea contradice este documento, consulta antes de proceder.

---

## 🎯 Visión de Producto

**Ledger** es una app self-hosted de gestión de gastos de viaje. El repositorio es público; cada usuario despliega su propia instancia. No hay instancia central gestionada por el autor.

### Estado actual (2026-05-22)
- **v2.0** en producción — sistema de roles (admin/user/guest), invitación por email
- **FASE I** completada — módulo itinerario TripLeg con todos los tipos de tramo
- **FASE VII** completada — Guest Mode (read-only) con banner y bloqueo de escritura
- **FASE VIII** completada — Gestión de usuarios con invitación por email, SMTP vía mail_*
- **FASE VI-2/3/4** pendientes — tarjetas de embarque OCR, aerolíneas, hoteles Google Places

### MVP v1.0 (completado)
- Captura y gestión de gastos de viaje
- OCR de facturas con Claude Haiku
- Exportación para reembolso corporativo

### v2.0 en curso
- FASE I ✅ — Itinerario: TripLeg ampliado (flight/accommodation/car_rental/train/bus/ferry), Haversine, documentos adjuntos, geocoding_service, frontend completo
- FASE II — Stats dentro del viaje (Recharts)
- FASE III — Stats globales
- FASE IV — Mapa (Leaflet + geocoding automático)

### Aparcado indefinidamente (no eliminar código existente)
- `[✗ activo]` Bot Telegram — aparcado, no implementar
- `[✗ activo]` Android — aparcado, no implementar
- `[✗ activo]` FASE 5 Sync — aparcada sin cliente Android activo

---

## 🗺️ Arquitectura General

```
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Backend                        │
│   PostgreSQL (NAS) · Paperless-ngx (NAS) · Claude Haiku  │
└──────┬──────────────┬──────────────┬─────────────────────┘
       │              │              │
   Next.js        Android        Bot Telegram
   Web App     (APARCADO)       (APARCADO)
```

**Stack por capa:**

| Capa | Tecnología |
|------|-----------|
| Backend API | Python 3.12 · FastAPI · SQLAlchemy async · Alembic · Pydantic v2 |
| Base de datos | PostgreSQL 16 dedicado en NAS UGREEN, puerto 5433, DB `ledger` |
| Almacenamiento ficheros | Paperless-ngx en NAS vía API REST (o volumen Docker temporal) |
| OCR | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) Vision — único motor OCR |
| Frontend Web | Next.js 14 · App Router · TypeScript · shadcn/ui · Tailwind CSS |
| i18n Web | Sistema propio — `frontend/lib/i18n.tsx` (Context + JSON), cookie `NEXT_LOCALE` |
| Bot Telegram | python-telegram-bot · Haiku 4.5 (APARCADO) |
| App Android | Kotlin · Jetpack Compose (APARCADO) |
| Infraestructura | Docker Compose en LXC Proxmox (768 MB RAM) |

### Infraestructura de despliegue

```
NAS UGREEN (YOUR_NAS_IP, Docker)
├── postgres-ledger       ← PostgreSQL 16, puerto 5433, DB "ledger"
├── paperless-ngx         ← almacén de facturas e imágenes
└── nginx-proxy-manager   ← proxy inverso TLS

LXC Proxmox (YOUR_SERVER, 768 MB RAM, nesting habilitado)
└── /opt/ledger/docker-compose.yml
    ├── backend   (FastAPI :8000)   ~200 MB RAM
    ├── frontend  (Next.js :3000)   ~300 MB RAM
    └── bot       (PTB :8080)       ~100 MB RAM  ← skeleton existente, sin lógica
```

**Servicios eliminados — no recrear:**
- `[✗]` PostgreSQL propio en LXC → usar postgres-ledger del NAS (puerto 5433)
- `[✗]` MinIO → imágenes van a Paperless-ngx o volumen Docker temporal
- `[✗]` Ollama → usar Claude Haiku 4.5 API
- `[✗]` Tesseract → usar Claude Haiku 4.5 Vision
- `[✗]` Integración Uber → no hay API pública gratuita

---

## 🔐 Sistema de Registro y Acceso

### Reglas de registro (self-hosted)

| Situación | Comportamiento |
|-----------|---------------|
| Tabla `users` vacía | Registro libre — primer usuario se convierte en `is_admin=True` |
| Tabla `users` no vacía + `ALLOW_REGISTRATION=true` | Registro abierto |
| Tabla `users` no vacía + `ALLOW_REGISTRATION=false` | Registro cerrado — mostrar mensaje claro en `/register` |

- `ALLOW_REGISTRATION` — variable de entorno en `.env`, default `false`
- No existe `REGISTRATION_INVITE_CODE` — eliminado
- No existe endpoint `POST /api/auth/validate-invite` — eliminado
- El campo `is_admin` existe en el modelo `User` pero no hay panel de admin en MVP

### Web /register
- Campo `confirm_password` — validación client-side al submit (passwords deben coincidir)
- Sin campo invite_code
- Si el backend devuelve 403 (registro cerrado) → mostrar mensaje "El registro está cerrado. Contacta con el administrador."

---

## 👤 Perfil de Usuario y Configuración

### Campos del perfil (`/settings/profile`)

**Cuenta**
- `name` — nombre del usuario
- `email` — email (cambio requiere verificación futura, en MVP solo actualiza)
- `password` — cambio de contraseña (requiere contraseña actual)
- `currency_base` — moneda de reporting (ISO 4217)
- `language` — idioma preferido (`es` | `en`), sobreescribe detección del navegador
- `theme` — tema visual (`system` | `light` | `dark`), sobreescribe preferencia del SO

**OCR (integración Anthropic)**
- `anthropic_api_key` — clave API propia del usuario (opcional, cifrada en BD)
- Si no configurada → el backend usa `ANTHROPIC_API_KEY` del `.env` como fallback
- Modelo fijo: `claude-haiku-4-5-20251001`

**Paperless-ngx (integración)**
- `paperless_url` — URL de la instancia Paperless del usuario
- `paperless_token` — token API de Paperless (cifrado en BD)
- `paperless_enabled` — toggle on/off
- Si no configurado o `paperless_enabled=false` → imágenes al volumen Docker temporal
- Botón "Verificar conexión" → `POST /api/settings/verify-paperless`

### Almacenamiento de configuración sensible

- Tabla `user_settings` (ya existe como `Setting`) — clave/valor por usuario
- Claves con sufijo `_key` o `_token` se cifran con **Fernet** antes de guardar en BD
- La `SECRET_KEY` del `.env` se usa para derivar la clave Fernet (reutilizar la misma del JWT)
- Fallback: si el usuario no tiene key → usar variable de entorno del servidor
- `crypto_utils.py` — funciones `encrypt(value: str) -> str` y `decrypt(value: str) -> str`

### Almacenamiento temporal de imágenes (sin Paperless)

- Volumen Docker `ledger_uploads` montado en `/app/uploads/` dentro del contenedor
- Estructura: `/app/uploads/{user_id}/{expense_id}.{ext}`
- Al configurar Paperless: `BackgroundTasks` migra automáticamente todos los archivos pendientes del usuario
- Si la migración falla para un archivo: loguear error, continuar con el siguiente (no bloquear)
- El campo `Expense.local_path` almacena la ruta temporal (`str | None`)

---

## 🌍 Internacionalización (i18n)

- **Sistema propio** — sin `next-intl`. Implementado en `frontend/lib/i18n.tsx`.
- Ficheros de mensajes: `frontend/messages/{es,en,fr}.json`
- Provider: `I18nProvider` en `layout.tsx` envuelve toda la app
- Hook de acceso: `useT()` (traducciones) + `useI18n()` (locale + cambio de idioma)
- Sin prefijo de locale en URLs (`/trips` no `/es/trips`)
- Locale detectado del navegador por defecto
- Override: selector en `/settings/profile` → guardado en cookie `NEXT_LOCALE` (30 días)
- Idiomas: **ES** (español, default) + **EN** (inglés) + **FR** (francés)
- ⚠️ NO usar `getTranslations()` ni `useTranslations()` — son de `next-intl`, que no está instalado

---

## 🌙 Dark Mode

- Implementado con Tailwind CSS `darkMode: 'class'`
- Por defecto: seguir preferencia del sistema (`prefers-color-scheme`)
- Override: toggle en `/settings/profile` → guardado en `localStorage` + clase `dark` en `<html>`
- `ThemeProvider` wrapper en `layout.tsx` gestiona la lógica

---

## 🗄️ Modelos de Base de Datos

### User
```python
id: UUID PK
email: str unique
name: str
password_hash: str
currency_base: str          # ISO 4217 — moneda de reporting ("CHF", "EUR"…)
is_admin: bool              # DEFAULT False — True solo para el primer usuario registrado
is_guest: bool              # DEFAULT False — True para cuenta guest@ledger.local
guest_of: UUID | None       # FK → users.id (ON DELETE SET NULL) — propietario cuya data ve el guest
is_active: bool             # DEFAULT True — False = usuario desactivado por admin
invite_token: str | None    # token de un solo uso enviado por email al invitar
invite_token_expires_at: datetime | None  # expiración del invite_token
must_change_password: bool  # DEFAULT False — True tras aceptar invitación, hasta cambiar password
invited_by: UUID | None     # FK → users.id — admin que generó la invitación
fcm_token: str | None       # aparcado, no usar en MVP
telegram_chat_id: str | None  # aparcado, no usar en MVP
created_at: datetime
updated_at: datetime
```

**Guest Mode (FASE VII):**
- Crear con: `docker compose exec backend python scripts/create_guest_user.py`
- Credenciales por defecto: ver script `scripts/create_guest_user.py`
- `get_effective_user_id`: dependency que devuelve `guest_of` si `is_guest=True`, sino `user.id`
- `require_not_guest`: dependency que lanza HTTP 403 en todos los endpoints de escritura
- Frontend: `useIsGuest()` hook + `GuestBanner` component + Settings bloqueado con redirect

### Setting (user_settings)
```python
id: UUID PK
user_id: UUID FK → users
key: str                    # clave de configuración
value: str | None           # valor (cifrado si es clave sensible)
created_at: datetime
updated_at: datetime
UNIQUE(user_id, key)
```

**Claves definidas:**
| key | descripción | cifrado |
|-----|-------------|---------|
| `paperless_url` | URL instancia Paperless | No |
| `paperless_token` | Token API Paperless | **Sí** |
| `paperless_enabled` | "true" / "false" | No |
| `anthropic_api_key` | API key Anthropic del usuario | **Sí** |
| `language` | "es" / "en" | No |
| `theme` | "system" / "light" / "dark" | No |
| `mail_host` | Servidor SMTP/IMAP (ej. mail.yourdomain.com) | No |
| `mail_imap_port` | Puerto IMAP (ej. "993") | No |
| `mail_smtp_port` | Puerto SMTP (ej. "587") | No |
| `mail_user` | Usuario de email | No |
| `mail_password` | Contraseña email | **Sí** |
| `mail_imap_folder` | Carpeta IMAP a vigilar (ej. "INBOX") | No |
| `mail_sender_filter` | Filtro remitente (ej. "@yourcompany.com"), vacío = aceptar todos | No |
| `mail_smtp_from` | Dirección remitente en emails enviados | No |
| `ocr_provider` | "claude" / "openai" / "ollama" / "gemini" | No |
| `openai_api_key` | API key OpenAI | **Sí** |
| `ollama_url` | URL Ollama (ej. "http://localhost:11434") | No |
| `ollama_model` | Modelo visión (ej. "llama3.2-vision") | No |
| `gemini_api_key` | API key Google AI Studio | **Sí** |

> ⚠️ Las claves SMTP/IMAP usan **siempre** el prefijo `mail_*`. Nunca usar variables de entorno `SMTP_*` ni claves `imap_*` en BD — todas unificadas bajo `mail_*`.

### LoyaltyCard
```python
id: UUID PK
user_id: UUID FK → users
program_name: str
program_type: Enum          # airline | train | hotel | car_rental | other
membership_number: str
tier: str | None
alias: str | None
created_at: datetime
updated_at: datetime
```

### Trip
```python
id: UUID PK
user_id: UUID FK → users
name: str
description: str | None
destination: str
start_date: date
end_date: date
primary_currency: str       # OBLIGATORIO
budget: Decimal
budget_currency: str
status: Enum                # active | closed | draft
created_at: datetime
updated_at: datetime
```

### TripLeg
```python
id: UUID PK
trip_id: UUID FK → trips
mode: Enum                  # flight | accommodation | car_rental | train | bus | ferry | other

# ── Comunes ──────────────────────────────────────────────────────────────
notes: str | None
document_path: str | None   # ruta interna en /app/uploads/legs/ — nunca exponer al cliente
expense_id: UUID | None FK → expenses (ON DELETE SET NULL)

# ── Transporte (flight | train | bus | ferry | other) ─────────────────
origin: str | None
destination: str | None
origin_lat: Decimal | None      # Numeric(9,6)
origin_lng: Decimal | None
destination_lat: Decimal | None
destination_lng: Decimal | None
departure_local: datetime | None  # naive, hora local del punto de salida
arrival_local: datetime | None    # naive, hora local del punto de llegada
carrier: str | None
flight_number: str | None
reservation_number: str | None
locator_code: str | None
seat: str | None
distance_km: Decimal | None  # calculado automáticamente con Haversine si mode=flight y hay coords
loyalty_card_id: UUID | None FK → loyalty_cards

# ── Alojamiento ───────────────────────────────────────────────────────
accommodation_name: str | None
accommodation_address: str | None
accommodation_lat: Decimal | None
accommodation_lng: Decimal | None
accommodation_provider: str | None
check_in: datetime | None
check_out: datetime | None

# ── Alquiler de coche ─────────────────────────────────────────────────
rental_company: str | None
pickup_location: str | None
pickup_lat: Decimal | None
pickup_lng: Decimal | None
dropoff_location: str | None
dropoff_lat: Decimal | None
dropoff_lng: Decimal | None
pickup_datetime: datetime | None
dropoff_datetime: datetime | None
confirmation_number: str | None

created_at: datetime
updated_at: datetime
```

**TripLegRead** — campos adicionales computados:
- `has_document: bool` — True si `document_path is not None` (el path nunca se serializa al cliente)

### Expense
```python
id: UUID PK
trip_id: UUID FK → trips
user_id: UUID FK → users
amount: Decimal
currency: str
amount_base: Decimal
rate_date: date
category: str               # Dining | Lodging | Transport | Culture | Shopping | Health | Other
description: str | None
date: date
payment_method: str | None  # card | cash | transfer | other
billable: bool              # DEFAULT True
loyalty_card_id: UUID | None FK → loyalty_cards
paperless_doc_id: int | None
local_path: str | None      # ruta en volumen Docker temporal (cuando no hay Paperless)
is_draft: bool              # DEFAULT False — True si creado por OCR pendiente de confirmar
ocr_raw: str | None
ocr_confidence: float | None
created_at: datetime
updated_at: datetime
```

### ExchangeRate
```python
id: UUID PK
from_currency: str
to_currency: str
rate: Decimal
date: date
created_at: datetime
UNIQUE(from_currency, to_currency, date)
```

---

## 🔌 Contrato API

### Auth
```
POST   /api/auth/register    → {name, email, password, confirm_password} → UserRead + tokens
POST   /api/auth/login       → {email, password} → tokens
POST   /api/auth/refresh     → {refresh_token} → tokens
POST   /api/auth/logout      → invalida refresh token
GET    /api/auth/status      → {registration_open: bool, has_users: bool}
```

### Users
```
GET    /api/users/me         → UserRead
PUT    /api/users/me         → {name?, email?, currency_base?, password_current?, password_new?}
```

### Settings
```
GET    /api/settings                    → {paperless_url, paperless_enabled, anthropic_api_key_set, language, theme}
PUT    /api/settings                    → {key, value} — upsert
POST   /api/settings/verify-paperless  → {ok: bool, error: str|null}
POST   /api/settings/migrate-now       → {migrated: int, failed: int, errors: list[str]}
```

> `anthropic_api_key_set` es bool — nunca devolver la key en texto plano al frontend.
> Para Paperless token igual: `paperless_token_set: bool`

### Trips
```
GET    /api/trips/           → lista (filtros: status, active)
POST   /api/trips/           → crear
GET    /api/trips/{id}/      → detalle
PUT    /api/trips/{id}/      → actualizar
DELETE /api/trips/{id}/      → borrar (cascade legs + expenses + Paperless docs)
POST   /api/trips/{id}/cover → imagen portada
```

### Legs (Itinerario)
```
GET    /api/trips/{id}/legs/                          → lista cronológica de tramos
POST   /api/trips/{id}/legs/                          → crear tramo → TripLegRead
PUT    /api/trips/{id}/legs/{leg_id}/                 → actualizar tramo
DELETE /api/trips/{id}/legs/{leg_id}/                 → borrar tramo + archivo adjunto
POST   /api/trips/{id}/legs/{leg_id}/document/        → subir documento adjunto (jpg/png/pdf/webp)
GET    /api/trips/{id}/legs/{leg_id}/document/        → descargar documento adjunto
```

**Notas Legs:**
- `distance_km` se calcula automáticamente con Haversine si `mode=flight` y hay `origin_lat/lng` + `destination_lat/lng`
- Ordenación: `COALESCE(departure_local, check_in, pickup_datetime, created_at)` ASC
- `TripLegRead.has_document: bool` — el path real nunca se expone al cliente
- `expense_id` vincula el tramo a un gasto del mismo viaje

### Expenses
```
GET    /api/expenses?trip_id=   → lista (filtros: billable, category, from, to)
POST   /api/expenses            → Flujo A: FormData, NO dispara OCR
GET    /api/expenses/{id}
PUT    /api/expenses/{id}       → pone is_draft=False automáticamente
DELETE /api/expenses/{id}       → cascade Paperless + borrar local_path si existe
```

### OCR / Receipts
```
POST   /api/receipts/upload  → Flujo B: imagen → Haiku OCR → Paperless/local → Expense is_draft=True
```

### Currency
```
GET    /api/currencies/rates
GET    /api/currencies/convert
```

### Reports / Export
```
GET    /api/reports/trip/{id}
GET    /api/reports/export/{id}?format=csv&only_billable=bool&from=date&to=date
GET    /api/reports/export/{id}/bundle?only_billable=bool&from=date&to=date
```

### Bot (skeleton, aparcado)
```
POST   /api/bot/link
GET    /api/bot/context/{chat_id}
```

---

## 🌍 Geocoding con Nominatim

- Servicio: `geocoding_service.py` — caché in-memory + asyncio.Lock + rate-limit 1 req/s
- API: `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`
- User-Agent obligatorio: `"Ledger/2.0 (homelab; self-hosted travel expenses app)"`
- Retorna `(lat, lng) | None`
- En FASE I: usado manualmente — el frontend envía coords al crear/editar un leg
- En FASE IV: geocodificación automática en background tras POST/PUT de expense y leg

---

## 💶 Sistema de Monedas

```
Expense.amount       → importe tal como se pagó (ej. ARS 15.000)
Expense.currency     → moneda del pago ("ARS")
Expense.amount_base  → convertido a User.currency_base con tipo del día
Expense.rate_date    → fecha del tipo de cambio (= fecha del gasto)
```

Fuente de tipos de cambio: **open.er-api.com** (gratuito, sin key). No usar exchangerate.host.

---

## 🔍 OCR — LlmOcrProvider (multi-motor)

**Arquitectura:** factory pattern + adaptadores independientes en `services/ocr_providers/`

| Motor | Clave config | Modelo | Notas |
|-------|-------------|--------|-------|
| `claude` (default) | `anthropic_api_key` → fallback `.env` | `claude-haiku-4-5-20251001` | Prompt caching ephemeral. Soporta PDF. |
| `openai` | `openai_api_key` (cifrada) | `gpt-4o-mini` | Sin soporte PDF. |
| `ollama` | `ollama_url` + `ollama_model` | configurable (default `llama3.2-vision`) | Sin API key. REST local. Timeout 120s. |
| `gemini` | `gemini_api_key` (cifrada) | `gemini-1.5-flash` | SDK google-generativeai. Soporta PDF. |

**Flujos:**
- Flujo A (manual): OCR **nunca** se dispara aunque haya imagen adjunta
- Flujo B (OCR): `POST /api/receipts/upload` → `Expense.is_draft=True`
- Boarding pass: `POST /api/trips/{id}/legs/{leg_id}/boarding-pass` → usa el mismo motor elegido

**Factory:** `ocr_factory.get_ocr_provider(db, user_id)` — lee `ocr_provider` de user_settings
**Interfaz:** `LlmOcrProvider.extract()` + `extract_boarding_pass()`
**Sin Tesseract, sin Ollama hardcodeado, sin modelos locales no configurados por el usuario**

---

## 📦 Export Bundle

- CSV: BOM UTF-8, punto decimal, ISO 8601
- ZIP naming plano: `{category}_{date}_{merchant-slug}.{ext}`
- Imágenes: de Paperless si configurado, de volumen local si no
- Nunca escribir a disco en el servidor — usar `io.BytesIO` / `io.StringIO`

---

## 🔒 Seguridad

| Aspecto | Implementación |
|---------|---------------|
| Passwords | bcrypt |
| JWT access | 30 min |
| JWT refresh | 7 días — HttpOnly cookie (web) |
| API keys en BD | Cifrado Fernet (SECRET_KEY del .env) |
| CORS | Orígenes explícitos, nunca `*` en prod |
| Uploads | Validar MIME por magic bytes, no por extensión |
| Haiku API key | Solo en backend, nunca en frontend |
| `is_admin` | No exponer lógica de admin en MVP — solo marcar al primer usuario |

### ⚠️ Limitaciones de seguridad conocidas

- **`SECRET_KEY`** — base de cifrado Fernet para API keys almacenadas en BD; **no rotable** sin re-cifrar todos los valores cifrados; no cambiar en producción sin plan de migración que descifre y re-cifre toda la tabla `user_settings`.
- **`/api/receipts/upload`** — sin rate limit; cada llamada consume tokens Anthropic. Si la instancia se expone a internet, añadir límite en nginx-proxy-manager (ej. `limit_req_zone` o regla de rate limiting en NPM).

---

## 📦 Dependencias Clave

### Backend (`requirements.txt`)
```
fastapi>=0.111
uvicorn[standard]>=0.29
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29
alembic>=1.13
pydantic[email]>=2.7
pydantic-settings>=2.2
passlib[bcrypt]>=1.7
bcrypt>=4.0,<5.0          # ← pin obligatorio, bcrypt 5.x rompe passlib
python-jose[cryptography]>=3.3
python-multipart>=0.0.9
cryptography>=42.0         # ← Fernet para cifrado de API keys
Pillow>=10.3
anthropic>=0.25
httpx>=0.27
aiofiles>=23.0             # ← manejo async de ficheros en volumen temporal
pytest>=8.2
pytest-asyncio>=0.23
```

### Frontend (`package.json`)
```json
"next": "14.x",
"next-themes": "^0.x"
```
> ⚠️ `next-intl` **no está instalado**. El i18n usa sistema propio en `lib/i18n.tsx`.

---

## 🛠️ Deuda Técnica Conocida

> Identificada en auditoría 2026-05-23. No bloquea el funcionamiento actual pero debe tenerse en cuenta antes de escalar.

- **`Expense.payment_method` (str legacy)** coexiste con `payment_method_id` (FK a tabla `payment_methods`). El campo string no se usa en nuevas funcionalidades pero persiste en el modelo. Pendiente migración completa: eliminar `payment_method` (str) y usar exclusivamente `payment_method_id`.
- **Hueco de migraciones 0015/0016** — estas versiones se ejecutaron en desarrollo pero fueron rolled-back antes de producción. La migración 0017 consolida los cambios. No es un error activo, pero el historial de Alembic tiene una discontinuidad documentada.
- **Volumen `ledger_uploads` sin backup documentado** — las imágenes subidas antes de configurar Paperless-ngx viven en este volumen Docker. Si el LXC muere sin snapshot, se pierden. Documentar o automatizar backup hacia NAS.

---

## 🔧 Variables de Entorno Nuevas

Toda variable nueva en `.env.example` **debe añadirse también a**:
1. `docker-compose.yml` → sección `environment:` del servicio correspondiente
2. `backend/app/core/config.py` → clase `Settings`
3. `.env` del LXC en producción (manualmente vía SSH)

Si se olvida cualquiera de estos tres pasos, la variable llegará vacía al contenedor aunque esté en el `.env` del host.

---

## 🔄 Workflow del Agente

0. Ejecutar `/clear` al inicio de cada sesión nueva.
1. Leer `CLAUDE.md` → `MEMORY.md` → `BEST_PRACTICES.md` → `TODO.md`
2. Completar tarea
3. Marcar `[x]` en `TODO.md`
4. Actualizar `MEMORY.md` (fecha, sesión, completado, bugs)
5. Commit + push a GitHub (`main`)
6. Deploy: `ssh root@YOUR_SERVER "cd /opt/ledger && git pull origin main && docker compose up -d --build [servicio]"`
7. Verificar con `docker compose exec [servicio] grep -n "NUEVO_CODIGO" /app/ruta/archivo.py`

---

## 🚫 Reglas Absolutas para Agentes

1. Nunca lógica de negocio en routers FastAPI — solo en services.
2. Nunca `print()` en producción — usar `logger`.
3. Nunca `any` en TypeScript con strict mode.
4. Nunca escribir a disco en el backend salvo en `/app/uploads/` (volumen temporal).
5. Nunca exponer `password_hash`, `anthropic_api_key`, `paperless_token` en schemas Read.
6. Nunca avanzar una fase sin que sus bloqueantes `[!]` estén completos.
7. Nunca commitear `.env`, API keys, `node_modules/`, `__pycache__/`.
8. Nunca usar MinIO, Tesseract, PaddleOCR ni Ollama.
9. Nunca exponer `ANTHROPIC_API_KEY` al cliente web.
10. Flujo A (manual): OCR nunca se dispara aunque haya imagen adjunta.
11. `billable` DEFAULT True en todo gasto nuevo.
12. Las imágenes se empaquetan en memoria para export — nunca a disco temporal del servidor.
13. La BD es exclusivamente `postgres-ledger` (NAS, puerto 5433).
14. Frontend web: llamadas al backend siempre por `/api/proxy/*`, nunca directamente.
15. Currency service: `open.er-api.com`. No usar `exchangerate.host`.
16. Rama git: siempre `main`. Nunca `master`.
17. Cifrar con Fernet toda clave con sufijo `_key` o `_token` en `user_settings`.
18. Devolver siempre `*_set: bool` en lugar de la clave real en respuestas API.
