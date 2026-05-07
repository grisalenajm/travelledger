# CLAUDE.md — Guía de Arquitectura Ledger

> Documento de referencia para todos los agentes Claude Code.
> Leer completo antes de tocar cualquier fichero del proyecto.
> Si algo en tu tarea contradice este documento, consulta antes de proceder.

---

## 🎯 Visión de Producto vs MVP

### Visión original
Herramienta global de gestión de viajes: itinerarios, logística, integración con proveedores (vuelos, hoteles, transporte), herramienta corporativa completa.

### MVP actual (intencional)
- Captura y gestión de gastos de viaje
- OCR de facturas con Claude Haiku
- Exportación para reembolso corporativo

La simplificación es deliberada. Las funciones de gestión de viaje más amplias están en FASE 9 backlog — no descartadas, solo pospuestas.

### Loyalty Cards — ubicación en UI
Las tarjetas de viajero frecuente (frequent flyer, hotel, tren) pertenecen a **Configuración de usuario**, no al flujo de gastos.

- CRUD en: `/settings` web · `SettingsScreen` Android
- Selector en: formulario de gasto (referencia a las tarjetas ya configuradas)
- **No** crear pantallas de gestión de tarjetas dentro de Trips ni Expenses

Estado actual:
| Cliente | CRUD | Selector en formulario |
|---------|------|------------------------|
| Web | ✅ `/settings/cards` | ✅ `add-expense-modal.tsx` |
| Android | ✗ pendiente (A8) | ✗ pendiente (A8) |

---

## 🗺️ Visión General

**Ledger** es una app de gestión de gastos de viaje con tres clientes activos que comparten un único backend:

```
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Backend                        │
│   PostgreSQL (NAS) · Paperless-ngx (NAS) · Claude Haiku  │
└──────┬──────────────┬──────────────┬─────────────────────┘
       │              │              │
   Next.js        Android        Bot Telegram
   Web App        Kotlin          Haiku LLM
```

**Stack por capa:**

| Capa | Tecnología |
|------|-----------|
| Backend API | Python 3.12 · FastAPI · SQLAlchemy async · Alembic · Pydantic v2 |
| Base de datos | PostgreSQL 16 **dedicado Ledger** en NAS UGREEN, **puerto 5433**, DB `ledger` |
| Almacenamiento ficheros | **Paperless-ngx en NAS** vía API REST — único almacén de imágenes |
| OCR | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) Vision — único motor OCR |
| Frontend Web | Next.js 14 · App Router · TypeScript · shadcn/ui · Tailwind CSS |
| App Android | Kotlin · Jetpack Compose · MVVM + Clean · Hilt · Room · Retrofit |
| Bot Telegram | Python 3.12 · python-telegram-bot · **Claude Haiku 4.5** (texto + visión) |
| Infraestructura | Docker Compose en LXC Proxmox (768 MB RAM) · GitHub Actions CI |

### Infraestructura de despliegue

```
NAS UGREEN (Docker)
├── postgres-ledger       ← contenedor PostgreSQL 16 EXCLUSIVO para Ledger
│                           puerto 5433, DB "ledger"
│                           NO es postgres-vectorchord
├── paperless-ngx         ← almacén de facturas e imágenes de tickets
└── nginx-proxy-manager   ← proxy inverso TLS

Proxmox LXC (768 MB RAM, 10 GB disco, nesting habilitado)
└── docker-compose.yml
    ├── backend   (FastAPI)   ~200 MB RAM
    ├── frontend  (Next.js)  ~300 MB RAM
    └── bot       (PTB)      ~100 MB RAM
```

## Acceso SSH al LXC
- Host: 192.168.1.125
- Usuario: root
- Clave: ~/.ssh/id_ed25519 (sin passphrase)
- Proyecto: /opt/ledger

---

**Reglas fijas de infra — no cambiar sin consenso:**
- `postgres-ledger` es un contenedor **propio y aislado** en el NAS, no compartido con ninguna otra app.
- Puerto **5433** para no colisionar con el 5432 de otros servicios del NAS.
- No hay MinIO, Tesseract, PaddleOCR ni Ollama en ningún sitio.
- Las imágenes de tickets van siempre a Paperless-ngx, nunca a disco local ni a otro almacén.

---

## 📁 Estructura de Directorios

```
ledger/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # FastAPI routers
│   │   ├── services/        # lógica de negocio
│   │   └── core/            # security, dependencies
│   ├── alembic/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/                 # Next.js App Router
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── ...
├── android/
│   └── app/src/main/
│       ├── data/            # repositories, daos, api
│       ├── domain/          # usecases, models
│       └── ui/              # screens, viewmodels, theme
├── bot/
│   ├── main.py
│   ├── config.py
│   ├── handlers/
│   ├── llm_service.py       # Haiku 4.5 directo, sin routing
│   ├── ledger_client.py
│   ├── session.py
│   ├── trip_resolver.py
│   ├── prompts/
│   └── tests/
├── docker-compose.yml       # LXC: backend + frontend + bot
├── docker-compose.dev.yml   # dev: hot-reload
├── nas-postgres-ledger.yml  # NAS: fragmento para postgres-ledger
├── .env.example
├── CLAUDE.md                ← este fichero
├── MEMORY.md
├── TODO.md
├── BEST_PRACTICES.md
└── DESIGN_SYSTEM.md
```

---

## 🔌 Contrato API — Endpoints Principales

> Si un endpoint cambia de contrato, actualizar esta sección Y notificar en MEMORY.md.

### Auth
```
POST   /api/auth/register
POST   /api/auth/login           → {access_token, refresh_token}
POST   /api/auth/refresh         → {access_token}
POST   /api/auth/logout          → 204
POST   /api/auth/device          → registra FCM token Android
```

### User / Profile
```
GET    /api/users/me             → perfil completo del usuario
PUT    /api/users/me             → actualizar (name, currency_base)
```

### Loyalty Cards (tarjetas de viajero frecuente)
```
GET    /api/loyalty-cards             → lista del usuario autenticado
POST   /api/loyalty-cards             → crear tarjeta
PUT    /api/loyalty-cards/{id}        → actualizar (tier, alias)
DELETE /api/loyalty-cards/{id}        → borrar
```

### Trips
```
GET    /api/trips                     → lista de viajes del usuario
POST   /api/trips                     → crear viaje
GET    /api/trips/{id}                → detalle
PUT    /api/trips/{id}                → actualizar
DELETE /api/trips/{id}                → borrar en cascade
GET    /api/trips/{id}/summary        → {spent_base, budget_base, currency_base,
                                         percentage, expense_count, legs_count}
```

### Trip Legs (tramos de transporte)
```
GET    /api/trips/{id}/legs           → lista de tramos del viaje
POST   /api/trips/{id}/legs           → crear tramo
PUT    /api/trips/{id}/legs/{leg_id}  → actualizar
DELETE /api/trips/{id}/legs/{leg_id}  → borrar
```

### Expenses
```
GET    /api/expenses?trip_id=         → lista gastos (filtros: billable, category, from, to)
POST   /api/expenses                  → Flujo A: crear gasto manual (multipart, imagen opcional)
                                        NO dispara OCR aunque haya imagen
                                        ⚠ Usa Form(...) en FastAPI — el cliente DEBE enviar FormData, nunca JSON
GET    /api/expenses/{id}             → detalle
PUT    /api/expenses/{id}             → actualizar
DELETE /api/expenses/{id}             → borrar + cascade Paperless
```

### OCR / Receipts
```
POST   /api/receipts/upload           → Flujo B: sube imagen → Haiku OCR →
                                        sube a Paperless → crea Expense en is_draft=True
                                        Devuelve ExpenseRead completo (con id)
                                        Cliente redirige a /trips/[id]/expenses/[expenseId]
```

### Currency
```
GET    /api/currencies/rates          → tipos de cambio del día (base + symbols)
GET    /api/currencies/convert        → conversión puntual (amount, from, to, date)
```

### Sync (Android offline)
```
POST   /api/sync/push                 → lista PendingOperation → resultados
GET    /api/sync/pull?since=          → {trips[], legs[], expenses[], deleted_ids[]}
```

### Reports / Export
```
GET    /api/reports/trip/{id}                    → breakdown categorías + totales
GET    /api/reports/export/{id}?format=csv       → CSV de gastos
GET    /api/reports/export/{id}/bundle           → ZIP con CSV + imágenes Paperless
       ?only_billable=true|false                 → default false (todos los gastos)
       ?from=YYYY-MM-DD&to=YYYY-MM-DD            → rango fechas opcional
```

### Settings
```
GET    /api/settings                  → {paperless_url: str|null, paperless_token: str|null}
PUT    /api/settings                  → {key: str, value: str|null} — upsert (claves permitidas: paperless_url, paperless_token)
POST   /api/settings/verify-paperless → {ok: bool, error: str|null} — prueba conexión con credenciales guardadas
```

### Bot (internal)
```
POST   /api/bot/link                  → vincula telegram_chat_id con User
GET    /api/bot/context/{chat_id}     → {user_id, active_trip}
```

---

## 💶 Sistema de Monedas (dos niveles)

### Regla fundamental
Cada gasto tiene **exactamente dos importes**: el transaccional y el base.

```
Expense.amount       → importe tal como se pagó (ej. ARS 15.000)
Expense.currency     → moneda del pago ("ARS")
Expense.amount_base  → convertido a la moneda base del usuario (ej. CHF 15.20)
Expense.rate_date    → fecha del tipo de cambio usado (= fecha del gasto, no de hoy)
```

La moneda base del usuario (`User.currency_base`) es la moneda de reporting corporativo. Todos los totales, presupuestos y dashboards se muestran en esta moneda.

### Moneda por defecto al crear gastos
`Trip.primary_currency` es **obligatorio** al crear el viaje. Es la moneda pre-seleccionada en el formulario de nuevo gasto. El usuario puede cambiarla libremente por gasto individual.

### Presupuesto del viaje
`Trip.budget` + `Trip.budget_currency` definen el presupuesto. Si `budget_currency` difiere de `User.currency_base`, se convierte al vuelo para el progress bar del dashboard.

### Conversión de divisas
`currency_service.convert(amount, from_currency, to_currency, date)`:
- Usa el tipo del **día del gasto** (no del día de hoy)
- Cachea en la tabla `ExchangeRate` para evitar llamadas repetidas
- Fuente: **open.er-api.com** (`v6/latest/{base}`, sin API key, plan gratuito)
- Limitación: plan gratuito solo sirve tipos actuales, no históricos

---

## ✏️ Flujos de Creación de Gasto

### Flujo A — Entrada manual (sin OCR)
El usuario introduce los datos. La imagen es opcional y va a Paperless sin procesarse.

```
1. Usuario rellena: importe, moneda, categoría, fecha,
   descripción, facturable (default: true)
2. Opcionalmente adjunta imagen (foto o fichero)
3. POST /api/expenses (multipart)
4. Backend:
   a. Convierte amount → amount_base con tipo del día
   b. Si hay imagen: sube a Paperless → guarda paperless_doc_id
   c. Crea Expense — NO llama a Haiku en ningún caso
5. Devuelve ExpenseRead
```

**Invariante:** si el usuario introdujo los campos a mano, el OCR nunca se ejecuta.

### Flujo B — OCR primero, confirmar después
El usuario sube imagen. Haiku extrae los datos. El backend crea un Expense en estado draft.

```
1. Usuario selecciona/captura imagen (ticket foto, PDF factura)
2. POST /api/receipts/upload (multipart: file, trip_id)
3. Backend:
   a. Valida MIME por magic bytes (JPEG, PNG, WebP, PDF)
   b. Haiku 4.5 Vision → extrae campos estructurados (OcrExtracted)
   c. Sube imagen a Paperless → paperless_doc_id (fallo silencioso)
   d. Crea Expense con is_draft=True, ocr_raw, ocr_confidence
   e. Devuelve ExpenseRead (201)
4. Cliente redirige a /trips/[id]/expenses/[expenseId] para editar
5. Usuario revisa y ajusta → PUT /api/expenses/{id}
6. Backend pone is_draft=False automáticamente al hacer PUT
```

### Flujo B en Bot Telegram
```
Usuario envía foto
  → bot descarga de Telegram
  → POST /api/receipts/upload
  → recibe ExpenseRead (is_draft=True)
  → resuelve viaje activo (cascada de trip_resolver)
  → mensaje confirmación con inline keyboard [✅] [✏️] [❌]
  → usuario pulsa ✅ → PUT /api/expenses/{id} para confirmar (is_draft → False)
```

---

## 📤 Export Bundle (CSV + ZIP imágenes)

### Estructura del CSV
```
date, description, category, billable, payment_method, loyalty_card,
amount, currency, amount_base, base_currency,
exchange_rate, rate_date, paperless_url, image_file
```

- `billable`: true/false
- `loyalty_card`: alias de la tarjeta si la hay, vacío si no
- `exchange_rate`: tipo usado para la conversión
- `paperless_url`: URL directa al documento en Paperless (vacío si no hay imagen)
- `image_file`: nombre del fichero en el ZIP (vacío si no hay imagen)
- Decimales con punto, fechas ISO 8601, BOM UTF-8, vacíos como ""

### ZIP de imágenes
- Ficheros planos en la raíz del ZIP (sin subcarpetas)
- Naming: `{category}_{date}_{merchant-slug}.{ext}`
  - Ejemplo: `dining_2024-10-14_bistrot-paris.jpg`
  - Slugificación: minúsculas, acentos eliminados, espacios → `-`, no alfanumérico eliminado
- Las imágenes se descargan de Paperless al vuelo y se empaquetan en `io.BytesIO`
- Nunca se escriben a disco en el servidor

### Contenido del bundle ZIP
```
bundle_{trip_slug}_{export_date}.zip
├── gastos_{trip_slug}.csv
├── dining_2024-10-14_bistrot-paris.jpg
├── lodging_2024-10-15_hotel-shinjuku.jpg
└── transport_2024-10-16_taxi-narita.pdf
```

---

## 🗄️ Modelos de Base de Datos

### User
```python
id: UUID PK
email: str unique
name: str
password_hash: str
currency_base: str          # ISO 4217 — moneda de reporting del usuario ("CHF", "EUR"…)
fcm_token: str | None
telegram_chat_id: str | None
created_at: datetime
updated_at: datetime
```

### LoyaltyCard
```python
id: UUID PK
user_id: UUID FK → users
program_name: str           # "Iberia Plus", "Renfe +Renfe", "Miles & More"
program_type: Enum          # airline | train | hotel | car_rental | other
membership_number: str
tier: str | None            # "Silver", "Gold", "Platinum"…
alias: str | None           # nombre corto para mostrar en UI
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
primary_currency: str       # OBLIGATORIO — moneda por defecto al crear gastos en este viaje
budget: Decimal
budget_currency: str        # moneda en la que está definido el presupuesto
status: Enum                # active | closed | draft
created_at: datetime
updated_at: datetime
```

### TripLeg
```python
id: UUID PK
trip_id: UUID FK → trips
mode: Enum                  # flight | train | car | bus | ferry | other
origin: str                 # "MAD", "Madrid Atocha", texto libre
destination: str
departure_local: datetime   # hora local en punto de salida (naive, sin timezone)
arrival_local: datetime     # hora local en punto de llegada (naive, sin timezone)
carrier: str | None         # "Iberia", "Renfe AVE", "Air France"…
reservation_number: str | None
locator_code: str | None    # PNR o código localizador
loyalty_card_id: UUID | None FK → loyalty_cards
notes: str | None
created_at: datetime
updated_at: datetime
```

> Los datetimes son naive (sin TZ), representan la hora local del punto de origen/destino
> tal como el usuario los ve en el billete. Sin conversiones UTC.

### Expense
```python
id: UUID PK
trip_id: UUID FK → trips
user_id: UUID FK → users

amount: Decimal             # importe tal como se pagó
currency: str               # moneda transaccional ("ARS", "EUR", "JPY"…)
amount_base: Decimal        # convertido a User.currency_base con el tipo del día
rate_date: date             # fecha del tipo de cambio usado (= fecha del gasto)

category: str               # Dining | Lodging | Transport | Culture |
                            # Shopping | Health | Other
description: str | None
date: date                  # fecha del gasto (la del ticket, no la de creación)
payment_method: str | None  # card | cash | transfer | other
billable: bool              # DEFAULT True — facturable a empresa

loyalty_card_id: UUID | None FK → loyalty_cards  # programa que acredita este gasto
paperless_doc_id: int | None                      # ID del documento en Paperless-ngx

# Campos OCR (Fase 3 — Flujo B)
is_draft: bool              # DEFAULT False — True si creado por OCR pendiente de confirmar
ocr_raw: str | None         # texto crudo devuelto por Haiku (para debug)
ocr_confidence: float | None  # confianza autoevaluada por Haiku (0.0–1.0)

created_at: datetime
updated_at: datetime
```

> El modelo `Receipt` **no existe**. El OCR escribe directamente sobre `Expense`.
> `paperless_doc_id` se rellena en Flujo B (OCR) o directamente en Flujo A (manual con imagen).
> Al hacer PUT /api/expenses/{id}, `is_draft` se pone a False automáticamente.

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

### PendingOperation (sync Android)
```python
id: UUID PK
operation_id: UUID unique   # idempotency key generado en el cliente
user_id: UUID FK → users
type: Enum                  # create_expense | update_expense | delete_expense |
                            # create_trip | update_trip | delete_trip |
                            # create_leg | update_leg | delete_leg
payload: JSON
processed_at: datetime | None
created_at: datetime
```

### PushDevice (FCM Android)
```python
id: UUID PK
user_id: UUID FK → users
fcm_token: str unique
platform: str               # "android"
created_at: datetime
updated_at: datetime
```

---

## 🤖 Bot Telegram — Arquitectura Detallada

### Filosofía
Cliente conversacional stateless. Sin BD propia. Haiku 4.5 para todo — texto, intent, extracción, imágenes.

### Autenticación
- Shared secret `BOT_API_KEY` — no JWT de usuario.
- Vinculación: usuario genera `link_token` (JWT 15min) en Settings web → `/start <token>` → `POST /api/bot/link`.

### LLM — Haiku 4.5 directo, sin routing
```python
async def call_haiku(messages: list, system: str) -> str:
    response = await anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return response.content[0].text
```

### Flujos del bot
```
Texto libre → classify_intent → create | query | export | set_trip | unknown
Foto/PDF   → POST /api/receipts/upload → OcrResultDto → confirmación
"CSV del viaje" → GET /api/reports/export/{id}?format=csv → send_document
"Zip facturas"  → GET /api/reports/export/{id}/bundle    → send_document
```

### Lógica viaje activo (trip_resolver.py)
```
1. ¿Viaje forzado en sesión? → usar ese
2. ¿Exactamente 1 viaje con start_date ≤ hoy ≤ end_date? → usar ese
3. ¿Varios activos? → inline keyboard con opciones
4. ¿Ninguno? → mensaje pidiendo crear uno en la web
```

---

## 🔍 OCR con Claude Haiku 4.5

Único motor OCR del sistema. Sin fallbacks, sin Tesseract, sin modelos locales.

### Prompt caching
System prompt del OCR con `cache_control: ephemeral`. Solo se paga completo en la primera llamada de cada ventana de 5 minutos.

### Campos OCR en Expense (Flujo B)
El endpoint `POST /api/receipts/upload` NO usa un DTO separado — devuelve `ExpenseRead` directamente.
Los campos OCR se persisten en la tabla `expenses`:
- `is_draft: bool` — True hasta que el usuario confirma con PUT
- `ocr_raw: text | None` — texto crudo de la respuesta de Haiku (para debug)
- `ocr_confidence: float | None` — confianza autoevaluada por Haiku (0.0–1.0)

El modelo `Receipt` **no existe** — OCR escribe directamente sobre `Expense`.

`ocr_service.extract()` devuelve un dataclass interno `OcrExtracted` (no schema Pydantic):
```
date, amount, currency, category, description, confidence, raw_text
```

---

## 🔒 Seguridad

| Aspecto | Implementación |
|---------|---------------|
| Passwords | bcrypt |
| JWT access | 30 min |
| JWT refresh | 7 días — HttpOnly cookie (web) / DataStore cifrado (Android) |
| Bot auth | Shared secret `BOT_API_KEY` |
| Link token Telegram | JWT 15 min, un solo uso |
| CORS | Orígenes explícitos en `ALLOWED_ORIGINS`, nunca `*` en prod |
| Uploads | Validar MIME por magic bytes, no por extensión |
| Android | `network_security_config.xml`, no cleartext en prod |
| Haiku API key | Solo en backend y bot — nunca en frontend ni Android |

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
python-jose[cryptography]>=3.3
python-multipart>=0.0.9
Pillow>=10.3
anthropic>=0.25
httpx>=0.27
pytest>=8.2
pytest-asyncio>=0.23
```

### Bot (`bot/requirements.txt`)
```
python-telegram-bot>=21.0
httpx>=0.27
anthropic>=0.25
pydantic-settings>=2.2
pytest>=8.2
pytest-asyncio>=0.23
```

---

## 🔄 Workflow del Agente

- La rama principal es **main**. Nunca commitear a master.

---

## 🚫 Reglas Absolutas para Agentes

1. Nunca lógica de negocio en routers FastAPI — solo en services.
2. Nunca `print()` en producción — usar `logger`.
3. Nunca `any` en TypeScript con strict mode.
4. Nunca lógica en Composables — solo en ViewModel/UseCase.
5. Nunca escribir a disco en el backend (OCR, CSV, ZIP) — usar `io.BytesIO` / `io.StringIO`.
6. Nunca exponer `password_hash` en schemas `Read`.
7. Nunca avanzar una fase sin que sus bloqueantes `[!]` estén completos.
8. Nunca commitear `.env`, `google-services.json`, `local.properties`, API keys.
9. El bot nunca almacena datos de gastos localmente — todo via API al backend.
10. El bot nunca usa JWT del usuario — usa `BOT_API_KEY`.
11. Nunca usar MinIO, Tesseract, PaddleOCR ni Ollama.
12. Nunca exponer `ANTHROPIC_API_KEY` al cliente web ni a Android.
13. Flujo A (manual): el OCR nunca se dispara aunque haya imagen adjunta.
14. `billable` por defecto es `True` en todo gasto nuevo.
15. Las imágenes se empaquetan en memoria — nunca se escriben a disco en el servidor.
16. La BD de Ledger es **exclusivamente** `postgres-ledger` (puerto 5433) — no usar otros Postgres del NAS.
17. Android Retrofit: nunca hardcodear la URL base. Leer siempre de ConfigStore vía `DynamicUrlInterceptor`. Si ConfigStore no tiene URL → navegar a ConfigScreen, no usar fallback localhost.
