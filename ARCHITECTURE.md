# ARCHITECTURE.md — Ledger v2.0

> Documento de arquitectura del sistema **Ledger** (app self-hosted de gestión de
> gastos de viaje). Estado a 2026-05-23, tras completar FASE I–VIII (excepto
> ítems aparcados de Android/Telegram).
>
> Audiencia: cualquier agente o persona técnica que tenga que entender el sistema
> antes de tocarlo. Si encuentras discrepancias con `CLAUDE.md`, gana
> `CLAUDE.md` y este documento debe actualizarse.

---

## 1. Visión General

Ledger es una aplicación **self-hosted** de captura, análisis y exportación de
gastos de viaje, pensada para reembolso corporativo. Cada instancia es propiedad
del usuario que la despliega — no existe servicio central ni multi-tenant
gestionado por el autor.

El producto cubre cuatro capacidades nucleares:

1. **Captura de gastos** con OCR de tickets (Claude Haiku 4.5 Vision) y
   conversión multi-moneda con tipos de cambio diarios.
2. **Itinerario** estructurado por viaje (vuelos, alojamientos, alquileres,
   trenes, autobuses, ferries) con geocoding automático y distancias Haversine
   para vuelos.
3. **Estadísticas** por viaje y globales (Recharts), incluyendo stats de vuelos
   (km recorridos, rutas, aerolíneas).
4. **Exportación** para reembolso (CSV con BOM UTF-8 y bundle ZIP con imágenes,
   ambos generados en memoria — nunca a disco).

Sobre estas capacidades se han añadido en v2.0:

- **Sistema de roles** (admin / user / guest read-only).
- **Invitaciones por email** con SMTP por usuario y token de un solo uso.
- **Importación automática de emails de viaje** vía IMAP polling y webhook,
  generando tramos pendientes de asignación (vuelos, hoteles, coches, trenes; ES/EN/FR).
- **OCR de tarjetas de embarque** (boarding pass) con Haiku Vision.
- **Internacionalización ES / EN / FR** con cookie y selector en perfil.
- **Dark mode** con `next-themes` y override manual.

La filosofía de despliegue es minimalista: **Docker Compose** en un LXC de
Proxmox de 768 MB de RAM, apoyado en servicios externos del NAS UGREEN
(PostgreSQL, Paperless-ngx, nginx-proxy-manager).

---

## 2. Diagrama del Stack

```
                                  Internet
                                     │
                                     ▼
              ┌─────────────────────────────────────────────┐
              │       NAS UGREEN (YOUR_NAS_IP)              │
              │                                             │
              │   nginx-proxy-manager  (TLS termination)    │
              │      │                                      │
              │      └─→ ledger.dominio       → frontend:3000
              │      └─→ api.ledger.dominio   → backend:8000
              │                                             │
              │   postgres-ledger    :5433 (DB "ledger")    │
              │   paperless-ngx      (almacén de facturas)  │
              └─────────────────────────────────────────────┘
                                     ▲
                                     │ red interna
                                     │
              ┌──────────────────────┴─────────────────────────────┐
              │     LXC Proxmox (YOUR_SERVER, 768 MB RAM)            │
              │                                                     │
              │   ┌───────────────────────────────────────────┐     │
              │   │ docker compose                            │     │
              │   │                                           │     │
              │   │  ┌─────────────┐    ┌──────────────────┐  │     │
              │   │  │  frontend   │◄──►│   backend        │  │     │
              │   │  │  Next.js 14 │    │   FastAPI        │  │     │
              │   │  │  :3000      │    │   :8000          │  │     │
              │   │  │  ~300 MB    │    │   ~200 MB        │  │     │
              │   │  └──────┬──────┘    └────────┬─────────┘  │     │
              │   │         │                    │            │     │
              │   │         │  /api/proxy/*      │            │     │
              │   │         └────────────────────┘            │     │
              │   │                                           │     │
              │   │  ┌─────────────┐                          │     │
              │   │  │  bot        │  ← APARCADO (skeleton)   │     │
              │   │  │  PTB :8080  │                          │     │
              │   │  │  ~100 MB    │                          │     │
              │   │  └─────────────┘                          │     │
              │   │                                           │     │
              │   │  Volumen: ledger_uploads (/app/uploads/)  │     │
              │   └───────────────────────────────────────────┘     │
              └─────────────────────────────────────────────────────┘
                          │                       │
                          ▼                       ▼
           ┌─────────────────────────┐  ┌─────────────────────┐
           │  Servicios externos     │  │  Servicios externos │
           │  ─────────────────────  │  │  ─────────────────  │
           │  api.anthropic.com      │  │  Mailcow IMAP/SMTP  │
           │  open.er-api.com        │  │  mail.greywood...   │
           │  nominatim.openstreet…  │  │                     │
           │  api.unsplash.com (opt) │  │                     │
           │  gstatic.com (logos)    │  │                     │
           └─────────────────────────┘  └─────────────────────┘
```

Notas:

- **Browser → Frontend → Backend** es la única ruta válida. El frontend nunca
  expone tokens al cliente: el endpoint `/api/proxy/[...path]` añade el
  `Authorization: Bearer …` server-side a partir de la sesión NextAuth.
- El **bot Telegram** sigue desplegado por compatibilidad del compose, pero su
  lógica está aparcada (skeleton).
- El **scheduler IMAP** (APScheduler) vive dentro del proceso `backend` — no es
  un contenedor aparte.

---

## 3. Capas del Sistema

### 3.1 Frontend (Next.js 14)

Stack:

- **Next.js 14** App Router + React 18 + TypeScript estricto
- **TanStack Query v5** para data fetching (caché 5 min, retry 1)
- **NextAuth.js** (JWT strategy) con credentials provider
- **Tailwind CSS** con `darkMode: 'class'`
- **next-themes** para dark mode con preferencia del sistema
- **react-hook-form + zod** para validación de formularios
- **Recharts** para gráficos
- **Leaflet + react-leaflet** para el mapa de viaje
- **shadcn/ui** + componentes propios en `components/ui/*`
- **i18n custom** (Context + JSON, no `next-intl`) — ver §3.5 (i18n)

Rutas (App Router):

```
app/
├── (auth)/login/page.tsx          Login con doble llamada (proxy + signIn)
├── (auth)/register/page.tsx       Registro (solo si tabla users vacía o ALLOW_REGISTRATION)
├── invite/[token]/page.tsx        Aceptar invitación (público, sin auth)
├── set-password/page.tsx          Cambio forzado tras invitación
├── page.tsx                       Dashboard — viaje activo / próximo / accesos rápidos
├── trips/page.tsx                 Lista de viajes con filtros
├── trips/new/page.tsx             Crear viaje
├── trips/[id]/page.tsx            Detalle de viaje + lista de gastos
├── trips/[id]/edit/page.tsx       Editar viaje
├── trips/[id]/itinerary/page.tsx  Itinerario (legs)
├── trips/[id]/map/page.tsx        Mapa Leaflet con gastos y tramos
├── trips/[id]/stats/page.tsx      Stats del viaje
├── trips/[id]/expenses/[expenseId]/page.tsx   Editar gasto
├── expenses/scan/page.tsx         Subir imagen para OCR
├── expenses/scan/confirm/page.tsx Confirmar OCR antes de persistir
├── stats/page.tsx                 Stats globales + vuelos
├── legs/pending/page.tsx          Tramos importados pendientes de asignación
├── notifications/page.tsx         Lista de notificaciones
├── settings/page.tsx              Hub de ajustes
├── settings/profile/page.tsx      Perfil + OCR + Paperless + Apariencia
├── settings/users/page.tsx        Admin de usuarios (solo admin)
├── settings/cards/page.tsx        Tarjetas de fidelización
├── settings/payment-methods/page.tsx
├── api/proxy/[...path]/route.ts   Proxy → backend con Authorization + Cookie forwarding
├── api/register/route.ts          Helper de registro (público)
└── api/health/route.ts            Health del frontend
```

Componentes destacados (`components/`):

| Fichero | Responsabilidad |
|---------|-----------------|
| `providers.tsx` | `QueryClientProvider` + `SessionProvider` + `ThemeProvider` + `SessionGuard` |
| `session-guard.tsx` | Detecta `RefreshAccessTokenError` y hace `signOut` automático |
| `navbar.tsx` | TopBar (logo desktop / título dinámico móvil), avatar, notif badge |
| `layout/bottom-nav.tsx` | BottomNav móvil con tabs Home / Viajes / Escanear / Stats |
| `guest-banner.tsx` | Banner azul "Modo solo lectura" cuando `role === 'guest'` |
| `add-leg-modal.tsx` | Modal de creación/edición de tramo (todos los modos) |
| `add-expense-modal.tsx` | Modal de creación de gasto manual (Flujo A) |
| `boarding-pass-scanner.tsx` | UI de OCR de boarding pass (idle / uploading / preview) |
| `airline-autocomplete.tsx`, `airline-logo.tsx` | Autocompletado de aerolíneas con logo |
| `hotel-autocomplete.tsx` | Autocompletado de hoteles vía Nominatim |
| `iata-input.tsx` | Input con autocompletado de aeropuertos (IATA) |
| `trip-map.tsx` | Mapa Leaflet con markers de gastos y polilíneas de tramos |
| `leg-card.tsx`, `trip-card.tsx`, `expense-card.tsx` | Cards reutilizables |
| `export-modal.tsx` | Modal de exportación CSV / bundle ZIP con filtros |
| `upload-receipt-modal.tsx` | UI del flujo B (subir y procesar con OCR) |

Hooks (`hooks/`):

- `use-auth-status.ts` — estado de registro abierto/cerrado (público)
- `use-auth-store.ts` — store zustand vestigial (no clave para auth)
- `use-role.ts` — `useRole`, `useIsAdmin`, `useIsGuest` (fallback a `'user'`)
- `use-is-guest.ts` — re-export para compatibilidad
- `use-trips.ts`, `use-expenses.ts`, `use-trip-legs.ts`, `use-trip-stats.ts`,
  `use-trip-map.ts`, `use-global-stats.ts`, `use-flight-stats.ts` — TanStack Query
- `use-settings.ts`, `use-loyalty-cards.ts`, `use-payment-methods.ts`
- `use-notifications.ts` — incluye `enabled: !!session` para evitar bucles
- `use-airlines.ts`, `use-hotel-search.ts` — fetch directo con debounce
- `use-ocr.ts`, `use-receipt-upload.ts` — mutación de subida de tickets
- `use-toast.ts` — toast minimal (event bus interno)
- `use-is-mobile.ts` — breakpoint 768px

i18n (`lib/i18n.tsx`):

- Implementación propia (Context + JSON) — **no se usa `next-intl`** pese a lo
  que indica `CLAUDE.md`. Tres idiomas: `es` (default), `en`, `fr`.
- Cookie `NEXT_LOCALE` (30 días), fallback al `navigator.language`.
- `useT()` para componentes cliente; cualquier traducción faltante hace
  fallback al diccionario español.

Middleware (`middleware.ts`):

- Protege todas las rutas excepto `/login`, `/register`, `/invite`,
  `/api/auth`, `/api/health`, `/api/register`, `/api/proxy` y assets.
- Redirige a `/login?error=SessionExpired` si el token tiene
  `RefreshAccessTokenError`.
- Redirige a `/set-password` si `mustChangePassword=true`.

NextAuth (`lib/auth.ts`):

- Provider `credentials` con doble flujo:
  1. Login normal: llamada a `/api/auth/login`.
  2. **Login con tokens pre-fetched**: el formulario llama primero al proxy
     (`/api/proxy/auth/login`) para que el browser reciba la cookie HttpOnly
     `refresh_token`, y luego pasa los tokens a `signIn()` para que NextAuth no
     haga una segunda llamada.
- Callback `jwt`: refresca el access token cuando expira leyendo la cookie
  `refresh_token` mediante `cookies()` (App Router).
- Sesión incluye `role` (`admin | user | guest`), `isGuest`, `mustChangePassword`.

Proxy `/api/proxy/[...path]` (`app/api/proxy/[...path]/route.ts`):

- Sustituye la URL `/api/proxy/*` por `${API_INTERNAL_URL}/api/*`.
- Añade `Authorization: Bearer <accessToken>` desde la sesión NextAuth.
- Reenvía cookies del browser para que el backend pueda leer `refresh_token`.
- Reenvía `Set-Cookie` del backend al browser, reescribiendo `Path=/api/auth`
  → `Path=/api/proxy/auth` para que la cookie viaje en futuras peticiones del
  proxy.

### 3.2 Backend (FastAPI)

Stack:

- **FastAPI** con `redirect_slashes=False` global — ningún endpoint usa
  trailing slash.
- **SQLAlchemy 2.x async** + **asyncpg** (PostgreSQL).
- **Alembic** para migraciones.
- **Pydantic v2** para schemas y settings (`pydantic-settings`).
- **passlib[bcrypt]** + **python-jose** para JWT (bcrypt pin <5.0, obligatorio).
- **cryptography (Fernet)** para cifrado de claves sensibles en `user_settings`.
- **APScheduler** (`AsyncIOScheduler`) para polling IMAP.
- **slowapi** para rate-limiting en endpoints sensibles (`/auth/login`,
  `/auth/register`, `/auth/refresh`).
- **anthropic** SDK para Haiku Vision (OCR + boarding pass).
- **httpx** para peticiones a Paperless, open.er-api.com, Nominatim, Unsplash,
  gstatic.

Estructura:

```
backend/app/
├── main.py                 ── Lifespan, scheduler IMAP, CORS, middlewares
├── config.py               ── Settings (pydantic-settings) + logging.dictConfig
├── database.py             ── async engine + AsyncSessionLocal + get_db
├── core/
│   ├── dependencies.py     ── get_current_user, get_effective_user_id,
│   │                          require_not_guest, require_admin, verify_bot_request
│   ├── security.py         ── hash/verify password, create/decode tokens
│   ├── crypto_utils.py     ── encrypt/decrypt con Fernet (derivada del SECRET_KEY)
│   └── limiter.py          ── SlowAPI Limiter (con bypass por env SLOWAPI_NO_LIMITS)
├── models/                 ── ORM (User, Trip, TripLeg, Expense, Setting,
│                              LoyaltyCard, PaymentMethod, Notification,
│                              EmailImport, ExchangeRate)
├── schemas/                ── Pydantic v2 (auth, trip, trip_leg, expense,
│                              stats, map, notification, currency, loyalty_card,
│                              boarding_pass, airline)
├── routers/                ── 19 routers (auth, users, trips, legs, expenses,
│                              receipts, settings, stats, reports, currencies,
│                              airports, airlines, places, loyalty_cards,
│                              payment_methods, notifications, pending_legs,
│                              email, webhooks, health)
├── services/               ── lógica de negocio (ver §3.2.b)
├── data/                   ── airports.csv (OpenFlights), airlines.csv (1012)
├── alembic/versions/       ── 14 migraciones (0001…0017, con huecos 0002/15/16)
└── scripts/create_guest_user.py
```

#### 3.2.a Routers

Todos llevan `redirect_slashes=False` y prefijos sin barra final. Patrón
genérico: el router no hace lógica de negocio — delega en `services/*`.

| Router | Prefix | Endpoints clave | Auth |
|--------|--------|-----------------|------|
| `auth.py` | `/api/auth` | status, register, login, refresh, logout, device | mixto |
| `users.py` | `/api/users` | me (GET/PUT), set-password, invite, accept-invite, admin CRUD | mixto |
| `trips.py` | `/api/trips` | CRUD + summary + cover + stats + map-data | user/effective |
| `legs.py` | `/api/trips/{id}/legs` | CRUD + document + boarding-pass + geocode | not-guest |
| `expenses.py` | `/api/expenses` | CRUD multipart + geocode + receipt-url/image | mixto |
| `receipts.py` | `/api/receipts` | upload (Flujo B OCR) | not-guest |
| `settings.py` | `/api/settings` | GET/PUT + verify-paperless + migrate-now + test-smtp | mixto |
| `stats.py` | `/api/stats` | global, flights | effective |
| `reports.py` | `/api/reports` | trip summary + export CSV + bundle ZIP | effective |
| `currencies.py` | `/api/currencies` | rates, convert | user |
| `notifications.py` | `/api/notifications` | list, count, read-all, mark-read | mixto |
| `pending_legs.py` | `/api/legs` | pending, assign, update, discard | not-guest |
| `email.py` | `/api/email` | poll-now, test-connection | user |
| `webhooks.py` | `/api/webhooks` | email push (travel booking) | X-Webhook-Secret |
| `loyalty_cards.py` | `/api/loyalty-cards` | CRUD | not-guest |
| `payment_methods.py` | `/api/payment-methods` | CRUD | user |
| `airports.py` | `/api/airports/search` | búsqueda por IATA/ciudad | user |
| `airlines.py` | `/api/airlines/search` | búsqueda por IATA/nombre | user |
| `places.py` | `/api/places/hotels` | autocompletado Nominatim | user |
| `health.py` | `/health` | `SELECT 1` + status | público |

> **Convención clave**: los endpoints de lectura usan `get_effective_user_id`
> (que para guests devuelve `guest_of`), permitiendo que un guest vea los datos
> del owner. Los endpoints de escritura usan `require_not_guest` para
> bloquearlos con HTTP 403. Los de administración usan `require_admin`.

#### 3.2.b Services

| Service | Responsabilidad |
|---------|----------------|
| `user_service.py` | Invitaciones (create/resend/accept), toggle, change_role, delete |
| `trip_service.py` | CRUD Trip, summary, cover Unsplash (fire-and-forget) |
| `leg_service.py` | CRUD TripLeg, Haversine, IATA → coords sync, geocode_leg_bg async |
| `expense_service.py` | CRUD Expense, conversión moneda, EXIF GPS, geocode_expense_bg |
| `settings_service.py` | upsert con cifrado Fernet por clave, migrate_to_paperless |
| `ocr_service.py` | Haiku Vision para tickets (devuelve `OcrExtracted` dataclass) |
| `boarding_pass_service.py` | Haiku Vision para boarding pass (devuelve `BoardingPassOcrResult`) |
| `currency_service.py` | Tipos de cambio open.er-api.com con caché en `exchange_rates` |
| `export_service.py` | CSV con BOM + bundle ZIP en memoria (`io.BytesIO`) |
| `stats_service.py` | Agregados Trip / Global / Flight (puro Python) |
| `map_service.py` | Devuelve gastos geocodificados + puntos de tramos |
| `notification_service.py` | CRUD notificaciones |
| `imap_service.py` | IMAP4_SSL via `imaplib` (sync) + `asyncio.to_thread` |
| `email_processor.py` | Orquesta IMAP → travel_email_parser → pending legs + notif |
| `email_service.py` | SMTP STARTTLS/SSL para invitaciones y test |
| `travel_email_parser.py` | Parser genérico de emails de viaje (vuelo/hotel/coche/tren + .ics, ES/EN/FR) |
| `airline_service.py`, `airport_service.py` | Singletons CSV in-memory |
| `geocoding_service.py` | Nominatim (geocode + search_hotels) con caché y rate-limit |
| `paperless_service.py` | Upload (queued/blocking), download, delete, tags, metadata |
| `loyalty_card_service.py`, `payment_method_service.py` | CRUD simple |
| `unsplash_service.py` | Portadas opcionales para viajes |

Patrones recurrentes:

- **Background tasks de geocoding** abren su propia `AsyncSessionLocal`,
  hacen `await db.commit()` explícito y manejan rollback en `except`.
- **Endpoints normales** confían en el commit automático del `get_db()`
  (que hace `await session.commit()` al cerrar el generador).
- **Read schemas nunca** exponen `password_hash`, `anthropic_api_key`,
  `paperless_token`, `mail_password`, `local_path` ni `document_path`. Se usan
  flags booleanos `*_set` o `has_document`.

### 3.3 Base de datos (PostgreSQL 16)

DB `ledger` en `postgres-ledger` (NAS UGREEN, puerto 5433). Pool SQLAlchemy:
`pool_size=10, max_overflow=20, pool_pre_ping=True, pool_recycle=3600`.

Tablas:

```
users
 ├ id UUID PK
 ├ email str unique
 ├ name, password_hash, currency_base
 ├ is_admin, is_guest, is_active           (booleans, DEFAULT false/false/true)
 ├ guest_of  → users.id ON DELETE SET NULL
 ├ invite_token (unique), invite_token_expires_at,
 │  must_change_password, invited_by → users.id
 ├ fcm_token, telegram_chat_id              (aparcado, no usar)
 └ created_at, updated_at

settings (user_settings)
 ├ id UUID PK
 ├ user_id → users.id ON DELETE CASCADE
 ├ key str, value text (nullable)
 ├ UNIQUE(user_id, key) → uq_user_setting
 └ Claves cifradas con Fernet: anthropic_api_key, paperless_token, mail_password

trips
 ├ id UUID PK, user_id → users ON DELETE CASCADE
 ├ name, description, destination
 ├ start_date, end_date
 ├ primary_currency (OBLIGATORIO), budget, budget_currency, status
 ├ cover_doc_id (Paperless), cover_image_path (volumen local)
 └ created_at, updated_at

trip_legs
 ├ id UUID PK
 ├ trip_id → trips ON DELETE CASCADE  (NULLABLE: tramos pendientes)
 ├ user_id → users ON DELETE CASCADE  (NULLABLE para legacy)
 ├ mode str (flight | accommodation | car_rental | train | bus | ferry | other)
 ├ notes, document_path, expense_id → expenses ON DELETE SET NULL
 ├ Transporte: origin, destination, origin_lat/lng, destination_lat/lng,
 │             departure_local, arrival_local, carrier, flight_number,
 │             reservation_number, locator_code, seat, distance_km,
 │             loyalty_card_id → loyalty_cards ON DELETE SET NULL
 ├ Alojamiento: accommodation_name, _address, _lat, _lng, _provider, check_in, check_out
 ├ Coche: rental_company, pickup/dropoff_location, _lat, _lng, _datetime, confirmation_number
 ├ source (str, ej. "email_import"), confirmed (bool DEFAULT true)
 └ created_at, updated_at

expenses
 ├ id UUID PK
 ├ trip_id → trips ON DELETE CASCADE
 ├ user_id → users ON DELETE CASCADE
 ├ amount, currency, amount_base, rate_date
 ├ category, description, date, payment_method (free-form str)
 ├ billable (bool DEFAULT TRUE — CRÍTICO)
 ├ loyalty_card_id → loyalty_cards SET NULL
 ├ payment_method_id → payment_methods SET NULL
 ├ paperless_doc_id (int), local_path (str)
 ├ is_draft (bool DEFAULT false — true para OCR pendiente de confirmar)
 ├ ocr_raw (text), ocr_confidence (float)
 ├ location_lat, location_lng, location_name
 └ created_at, updated_at

loyalty_cards
 └ id, user_id, program_name, program_type, membership_number, tier, alias

payment_methods
 └ id, user_id, name, created_at
    (seed defaults: "Efectivo", "Tarjeta" — añadidos al registrar)

notifications
 └ id, user_id, type, title, message, data (text), read (bool), created_at

email_imports
 ├ id, message_id (str unique — dedup)
 ├ user_id → users CASCADE
 ├ imported_at, legs_created (int)

exchange_rates
 ├ id, from_currency, to_currency, rate (Numeric(18,8)), date
 └ UNIQUE(from_currency, to_currency, date) → uq_exchange_rate
```

Migraciones aplicadas (`alembic/versions/`):

```
34765b5418c8  create core models (users, trips, expenses, loyalty_cards, exchange_rates)
0001          create users (legacy — no usar para nuevos despliegues)
0003          trip cover_doc_id
0004          settings (user_settings)
0005          expense is_draft + ocr_raw + ocr_confidence
0006          users.is_admin
0007          expense.local_path
0008          trip.cover_image_path
0009          extend trip_leg v2 (vuelos/alojamiento/coche)
0010          expense.location_lat/lng/name
0011          payment_methods + expense.payment_method_id
0012          email_imports + trip_leg.source + .confirmed
0013          IMAP pending legs (trip_legs.user_id, DROP NOT NULL en trip_id)
0014          guest mode (users.is_guest, .guest_of)
0017          invite fields (invite_token, _expires_at, must_change_password,
              invited_by, is_active)
```

> Nota: faltan los archivos `0015_*.py` y `0016_*.py` — fueron rolled-back en
> producción (la columna `is_active` se añadió "a mano" y se materializó en
> `0017`, según comentarios del modelo `User`).

### 3.4 Infraestructura

```
LXC Proxmox (YOUR_SERVER)
├ Docker engine con nesting habilitado
├ /opt/ledger/docker-compose.yml
├ /opt/ledger/.env                  (secretos, fuera de git)
├ Volumen ledger_uploads → /app/uploads/ (montado en backend)
└ Memory limits:
    backend  220 MB (reserva 150)
    frontend 320 MB (reserva 200)
    bot      110 MB (reserva 70)

Healthchecks:
- backend  /health  (SELECT 1) cada 30s
- frontend /api/health         cada 30s
- bot      :8080/health         cada 60s

Networking interno:
- Red docker "ledger-net" (bridge)
- frontend → http://backend:8000 vía API_INTERNAL_URL (server-side proxy)
- bot      → http://backend:8000

NAS UGREEN (YOUR_NAS_IP)
├ postgres-ledger     :5433  DB "ledger"
├ paperless-ngx              token único por usuario en user_settings
└ nginx-proxy-manager        TLS + routing por subdominio
```

Workflow de deploy:

```bash
# Local
git push origin main

# LXC (vía SSH)
ssh root@YOUR_SERVER "
  cd /opt/ledger \
  && git pull origin main \
  && docker compose up -d --build [servicio]
"
```

### 3.5 Servicios Externos

| Servicio | Uso | API key | Coste |
|----------|-----|---------|-------|
| **api.anthropic.com** | OCR (Haiku 4.5) — tickets y boarding passes | `anthropic_api_key` por usuario, fallback `ANTHROPIC_API_KEY` env | de pago, ~0.0005 USD/imagen |
| **open.er-api.com** | Tipos de cambio diarios | sin key | gratuito |
| **nominatim.openstreetmap.org** | Geocoding + búsqueda de hoteles | sin key | gratuito (1 req/s) |
| **api.unsplash.com** | Portadas opcionales para viajes | `UNSPLASH_ACCESS_KEY` env | gratuito (50 req/h) |
| **gstatic.com/flights/airline_logos** | Logos de aerolíneas (cliente directo) | sin key | gratuito |
| **Paperless-ngx** | Almacén de facturas (NAS) | `paperless_token` por usuario | self-hosted |
| **IMAP/SMTP** | Polling de emails de viaje + envío de invitaciones | `mail_user` / `mail_password` por usuario | self-hosted |

---

## 4. Flujos Principales

### 4.1 Autenticación y Roles

```
┌──────────────────────────────────────────────────────────────────┐
│  Login normal                                                    │
├──────────────────────────────────────────────────────────────────┤
│  1. Browser → POST /api/proxy/auth/login                         │
│  2. Backend responde 200 con access+refresh tokens               │
│     y Set-Cookie: refresh_token; HttpOnly; Path=/api             │
│  3. Proxy reescribe Path=/api/auth → Path=/api/proxy/auth y      │
│     reenvía Set-Cookie al browser                                │
│  4. Browser → signIn("credentials", { accessToken, refreshToken })│
│  5. NextAuth.authorize() detecta tokens pre-fetched, llama       │
│     /api/users/me con Bearer y construye sesión con role         │
│     (guest > admin > user)                                       │
│  6. JWT con { accessToken, refreshToken, accessTokenExpires,     │
│     role, mustChangePassword, isGuest }                          │
│                                                                  │
│  Refresh: cuando access expira, jwt callback llama                │
│  /api/auth/refresh con la cookie HttpOnly (vía cookies())        │
│  o body fallback con el refresh embebido en el JWT.              │
└──────────────────────────────────────────────────────────────────┘
```

Roles:

- **admin**: `is_admin=true`. Acceso al panel `/settings/users` (invitar,
  toggle, change role, delete). Resto del comportamiento idéntico a user.
- **user**: por defecto. Acceso completo a sus propios viajes/gastos.
- **guest**: `is_guest=true` + `guest_of` apunta al owner. El backend usa
  `get_effective_user_id` para devolverle datos del owner en lectura.
  `require_not_guest` bloquea cualquier escritura. El frontend muestra
  `GuestBanner` y oculta el botón "ajustes" del navbar.

Invitaciones:

```
1. Admin invita en /settings/users → POST /api/users/invite
   → crea User inactivo con invite_token (32-byte urlsafe, expira 7 días),
     password aleatoria inutilizable, must_change_password=true.
2. send_invite_email lee config SMTP del admin (claves mail_*) y envía un
   email HTML con enlace a /invite/{token}.
3. Usuario abre /invite/{token} → GET /api/users/invite/{token} valida.
4. POST /api/users/accept-invite { token, password, name? } activa la
   cuenta y devuelve tokens JWT para auto-login.
5. Middleware detecta mustChangePassword y redirige a /set-password.
```

### 4.2 Creación de Gasto (Flujo A — Manual)

```
Frontend (add-expense-modal.tsx)
 └ FormData multipart: trip_id, amount, currency, category, date, ...,
   billable=true, image? (sin OCR)
   └ POST /api/proxy/expenses
        └ backend/routers/expenses.py:create_expense
             ├ ExpenseCreate validation (Pydantic)
             ├ expense_service.create(...)
             │   ├ currency_service.convert → amount_base, rate_date
             │   ├ Si image:
             │   │   ├ _extract_exif_gps → location_lat/lng (si EXIF)
             │   │   └ Si paperless_enabled='true' → paperless_service.upload_document
             │   │     (con poll de tarea); si falla → _save_local_image
             │   ├ Persistir Expense (is_draft=false, billable=true por DEFAULT)
             │   └ db.flush() + refresh
             └ Si location_name sin lat → background_tasks.add_task(geocode_expense_bg)
```

> **Regla absoluta del proyecto**: el Flujo A **nunca dispara OCR** aunque
> haya imagen adjunta — solo la guarda.

### 4.3 OCR de Factura (Flujo B — Vía Haiku)

```
Frontend (expenses/scan/page.tsx)
 └ POST /api/proxy/receipts/upload con file + trip_id
      └ routers/receipts.py:upload_receipt
           ├ _detect_mime (magic bytes, no extensión)
           ├ ocr_service.get_api_key (user setting → env fallback)
           ├ ocr_service.extract → OcrExtracted {date, amount, currency,
           │   category, description, confidence, raw_text}
           ├ _save_local siempre (backup)
           ├ Si paperless_enabled → upload_document_queued (fire-and-forget,
           │   no espera procesamiento — devuelve True/False)
           ├ currency_service.convert → amount_base
           ├ Persistir Expense con is_draft=True
           └ JSONResponse(ExpenseRead + optional 'warning')
                └ Frontend redirige a /expenses/scan/confirm para que el
                  usuario confirme / edite antes del PUT final.
                  El PUT desactiva is_draft automáticamente.
```

### 4.4 OCR de Boarding Pass

```
Frontend (boarding-pass-scanner.tsx)
 └ POST /api/proxy/trips/{tid}/legs/{lid}/boarding-pass con file
      └ routers/legs.py:upload_boarding_pass
           ├ Validar leg existe, pertenece al trip y mode==flight
           ├ Validar tamaño <10MB y MIME por magic bytes
           ├ Obtener anthropic_api_key del usuario
           ├ boarding_pass_service.extract_boarding_pass → BoardingPassOcrResult
           ├ Guardar imagen como document del leg (leg_service.upload_document)
           └ Devolver OCR result (no se aplica al leg automáticamente —
             el frontend muestra preview y el usuario confirma con PUT al leg)
```

### 4.5 Importación de Emails de Viaje

Hay dos puntos de entrada:

**Polling IMAP** (recomendado, `email_processor.process_pending_emails`):

```
APScheduler cada IMAP_POLL_INTERVAL_MINUTES (default 5)
 └ _resolve_user (WEBHOOK_USER_EMAIL → primer admin)
 └ _get_imap_config lee mail_* del user; si mail_enabled='true'
 └ imap_service.fetch_unseen_emails (IMAP4_SSL + UNSEEN + sender filter)
 └ Para cada email:
    ├ Dedup por message_id en email_imports
    ├ travel_email_parser.parse_travel_email_text (vuelo/hotel/coche/tren + .ics,
    │   ES/EN/FR; confianza baja → leg vacío + nota)
    ├ Crear TripLeg con trip_id=NULL, user_id=..., source='email_import',
    │   confirmed=False
    └ Crear Notification "Email: N tramos pendientes de asignación"
 └ commit batch al final
```

**Webhook push** (`routers/webhooks.py:receive_email`):

- Endpoint `POST /api/webhooks/email` protegido por `X-Webhook-Secret`.
- Mismo parser y mismo flujo de creación de legs pendientes.

**Asignación**:

```
Frontend /legs/pending
 └ GET /api/legs/pending → lista TripLegs con trip_id=NULL del usuario
 └ Para cada leg el usuario elige un Trip y → PUT /api/legs/{id}/assign
      └ Establece trip_id, confirmed=True, commit, refresh.
```

### 4.6 Geocodificación

Tres fuentes en cascada:

1. **EXIF GPS** del JPEG/PNG (síncrono al crear expense con imagen) —
   `expense_service._extract_exif_gps`.
2. **IATA lookup** (síncrono, en memoria) para legs de transporte —
   `leg_service._apply_iata_coords` consulta `airport_service` (CSV
   OpenFlights cargado al arrancar).
3. **Nominatim** (asíncrono, background task) — `geocoding_service.geocode`
   con caché in-memory, lock asyncio y rate-limit de 1 req/s
   (User-Agent obligatorio `"Ledger/2.0 (homelab; self-hosted travel expenses app)"`).

Los background tasks abren su propia `AsyncSessionLocal`, hacen `commit`
explícito y manejan rollback en `except`. Hay endpoints
`POST /api/expenses/geocode-pending` y
`POST /api/trips/{id}/legs/geocode-pending` para reprocesar lo que quedó
sin coords.

### 4.7 Export (CSV + ZIP bundle)

Endpoint `GET /api/reports/export/{trip_id}`:

- Construye un CSV con BOM UTF-8 (`"﻿"`), delimitador coma,
  decimal con punto, fechas ISO 8601.
- Columnas: `date, description, category, billable, payment_method,
  loyalty_card, amount, currency, amount_base, base_currency,
  exchange_rate, rate_date, paperless_url, image_file`.
- Filtros: `only_billable`, `from`, `to`.

Endpoint `GET /api/reports/export/{trip_id}/bundle`:

- Genera un ZIP en `io.BytesIO()` con:
  - El CSV anterior (referenciando ficheros locales).
  - Las imágenes de cada gasto: lee `local_path` si existe, sino descarga
    de Paperless (`paperless_service.download_document`).
- Naming plano: `{category}_{date}_{expense_id}.{ext}`.
- Headers: `Content-Type: application/zip`,
  `Content-Disposition: attachment; filename="bundle_{slug}_{YYYY-MM-DD}.zip"`.

> **Regla absoluta**: las imágenes nunca se escriben a un fichero temporal del
> servidor en este flujo — todo en memoria.

---

## 5. Decisiones de Arquitectura

### 5.1 ¿Por qué Next.js + FastAPI separados?

- **Frontend (Next.js 14 App Router)**: ofrece SSR/SSG, App Router, NextAuth y
  un ecosistema React maduro. El App Router permite usar `cookies()` en route
  handlers para leer la cookie HttpOnly del refresh token, lo que es clave
  para el flujo de refresh.
- **Backend (FastAPI)**: por velocidad de desarrollo con Pydantic v2, async
  nativo con `asyncpg`, generación de OpenAPI gratis y por familiaridad. La
  alternativa Django + DRF habría duplicado el footprint en memoria.

### 5.2 ¿Por qué un proxy `/api/proxy/[...path]` en el frontend?

Cuatro razones:

1. **No exponer el access token al cliente** — el JWT vive en la sesión
   NextAuth (cookie firmada), el browser nunca ve un Bearer en localStorage.
2. **Permitir la cookie HttpOnly del refresh_token** — el backend la emite
   con `Path=/api`, el proxy reescribe a `Path=/api/proxy/auth` y la cookie
   viaja transparentemente.
3. **Server-to-server interno** — el proxy llama a `http://backend:8000`
   (red Docker interna), no se expone el backend a internet directamente.
4. **Centraliza la lógica de refresh** — un único punto donde se sabe que
   el access token debe pasar.

### 5.3 ¿Por qué PostgreSQL en el NAS y no en el LXC?

El LXC tiene 768 MB. Postgres consume ~150 MB ya en idle. Centralizar la BD
en el NAS deja al LXC más holgura para backend/frontend y permite hacer
snapshots/backups con la herramienta del NAS sin coordinar con el LXC.

### 5.4 ¿Por qué Paperless-ngx (en lugar de MinIO)?

Paperless ya estaba desplegado en el NAS para otros propósitos (facturas
domésticas). Tener un único sistema documental con OCR propio, tags,
correspondents y storage paths reduce la complejidad. Cuando el usuario no
configura Paperless, las imágenes van a un volumen Docker temporal
(`/app/uploads/{user_id}/{expense_id}.{ext}`) — y `migrate_to_paperless` las
sube en background cuando configura el servicio.

### 5.5 ¿Por qué Claude Haiku 4.5 como único motor OCR?

- Vision multimodal, soporta JPEG/PNG/WebP/PDF.
- Coste muy bajo (~0.0005 USD/imagen).
- Prompt caching ephemeral reduce coste en lotes.
- Sin servidores GPU ni dependencias locales (Tesseract/Ollama eliminados).

Trade-off: dependencia de Anthropic. Mitigaciones: el usuario puede usar su
propia API key (cifrada con Fernet), el modelo se puede sustituir cambiando
una constante (`claude-haiku-4-5-20251001`).

### 5.6 ¿Por qué Nominatim y no Google Places?

- Gratuito, sin key, cumple los requisitos básicos.
- Trade-off: peor calidad para hoteles. Mitigación: cuando el usuario
  introduce un código IATA, se resuelve sin Nominatim a través de
  `airport_service`. Para hoteles se usa Nominatim con autocompletado.

### 5.7 ¿Por qué IMAP polling y no SMTP push?

Más portable: funciona con cualquier servidor IMAP sin tocar Postfix/Mailcow.
El trade-off (latencia de 5 min) es aceptable en este caso de uso. Se
mantiene el webhook como segunda vía para integraciones push si se
configuran.

### 5.8 ¿Por qué i18n custom y no `next-intl`?

`next-intl` fuerza prefijo de locale en la URL o requiere middleware extra.
El i18n custom de `lib/i18n.tsx` (Context + JSON) permite:

- URLs sin prefijo (`/trips` no `/es/trips`).
- Cambio de idioma sin reload (Context reactivo).
- Cookie `NEXT_LOCALE` simple para SSR-ready si fuera necesario.

Trade-off: no se cubren plurales ni formateo avanzado (no se necesitan).

### 5.9 ¿Por qué `redirect_slashes=False` en FastAPI?

Next.js elimina automáticamente trailing slashes en sus rutas. Si FastAPI
hiciera la redirección 307 al endpoint canónico, el Authorization header se
perdería en la redirección. La regla del proyecto es: **ningún endpoint
con trailing slash** y `redirect_slashes=False` global.

### 5.10 ¿Por qué Fernet (y no AES-GCM directo) para cifrar settings?

Fernet (parte de `cryptography`) viene con autenticación HMAC integrada,
rotación de keys soportada y un formato estable. La key se deriva del
`SECRET_KEY` del .env (reutilizando la del JWT), simplificando la gestión
de secretos.

Trade-off: si se rota el SECRET_KEY, las claves cifradas dejan de ser
descifrables. Documentado en `CLAUDE.md`.

---

## 6. Rutas API Completas

### Auth (`/api/auth`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/status` | público | `{registration_open, has_users}` |
| POST | `/register` | público* | Crear usuario (limit 10/min) — solo si tabla vacía o `ALLOW_REGISTRATION=true` |
| POST | `/login` | público | Login (limit 5/min) — devuelve tokens + cookie refresh |
| POST | `/refresh` | público* | Refresh (limit 20/min) — cookie-first, body-fallback |
| POST | `/logout` | user | Borra cookie `refresh_token` |
| POST | `/device` | user | Guarda `fcm_token` (aparcado) |

### Users (`/api/users`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/me` | user | Datos del usuario actual |
| PUT | `/me` | user | Actualizar nombre / currency / password |
| POST | `/set-password` | user (must_change=true) | Cambio forzado tras invitación |
| GET | `/invite/{token}` | público | Valida invitación (email + name) |
| POST | `/accept-invite` | público | Activa cuenta y devuelve tokens |
| GET | `` | admin | Listar usuarios |
| POST | `/invite` | admin | Invitar nuevo usuario + enviar email |
| POST | `/{id}/resend-invite` | admin | Regenerar token y reenviar email |
| PUT | `/{id}/toggle` | admin | Activar/desactivar cuenta |
| PUT | `/{id}/role` | admin | Cambiar is_admin |
| DELETE | `/{id}` | admin | Eliminar usuario |

### Trips (`/api/trips`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `` | effective | Lista (filtro `status`) |
| POST | `` | not-guest | Crear |
| GET | `/{id}` | effective | Detalle |
| PUT | `/{id}` | not-guest | Actualizar |
| DELETE | `/{id}` | not-guest | Borrar (CASCADE legs + expenses) |
| GET | `/{id}/summary` | effective | Resumen (gastado, presupuesto, %) |
| GET | `/{id}/stats` | effective | Stats del viaje |
| GET | `/{id}/map-data` | effective | Datos del mapa (gastos + tramos) |
| POST | `/{id}/cover` | not-guest | Subir portada (JPG/PNG/WebP) |
| GET | `/{id}/cover` | effective | Imagen de portada (FileResponse) |
| GET | `/{id}/cover-url` | user | URL pública en Paperless |

### Legs (`/api/trips/{id}/legs`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `` | effective | Lista cronológica |
| POST | `` | not-guest | Crear leg + background geocode |
| POST | `/geocode-pending` | not-guest | Reprocesar coords pendientes |
| PUT | `/{leg_id}` | not-guest | Actualizar leg |
| POST | `/{leg_id}/geocode` | not-guest | Geocodificar este leg ahora |
| DELETE | `/{leg_id}` | not-guest | Borrar leg + archivo |
| POST | `/{leg_id}/document` | not-guest | Subir documento (JPG/PNG/WebP/PDF) |
| GET | `/{leg_id}/document` | effective | Descargar documento (StreamingResponse) |
| POST | `/{leg_id}/boarding-pass` | not-guest | OCR boarding pass (Haiku) |

### Pending legs (`/api/legs`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/pending` | effective | Legs sin trip_id del usuario |
| PUT | `/{id}/assign` | not-guest | Asignar a un trip |
| PUT | `/{id}` | not-guest | Actualizar campos del leg pendiente |
| DELETE | `/{id}` | not-guest | Descartar |

### Expenses (`/api/expenses`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `` | effective | Lista (filtros trip_id, billable, category, date_from, date_to) |
| POST | `` | not-guest | Crear (FormData, sin OCR — Flujo A) |
| POST | `/geocode-pending` | user | Geocodificar todos los gastos con location_name sin coords |
| GET | `/{id}` | effective | Detalle |
| PUT | `/{id}` | not-guest | Actualizar (limpia is_draft) |
| POST | `/{id}/geocode` | user | Geocodificar este gasto ahora |
| DELETE | `/{id}` | not-guest | Borrar (cascade Paperless + local) |
| GET | `/{id}/receipt-url` | user | URL pública en Paperless |
| GET | `/{id}/receipt-image` | user | Imagen del recibo (local o Paperless) |

### Receipts (`/api/receipts`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/upload` | not-guest | Flujo B: imagen → Haiku → Expense is_draft=true |

### Settings (`/api/settings`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `` | user (oculta sensibles a guest) | Settings con `*_set` flags |
| PUT | `` | not-guest | Upsert clave (cifra `*_key`/`*_token`/`mail_password`) |
| POST | `/verify-paperless` | not-guest | Test de conexión con la instancia |
| POST | `/migrate-now` | not-guest | Migra imágenes locales a Paperless |
| POST | `/test-smtp` | not-guest | Envío de email de prueba |

### Stats (`/api/stats`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/global?period&year` | effective | Stats globales del año |
| GET | `/flights?period&year` | effective | Stats de vuelos (km, rutas, carriers) |

### Reports (`/api/reports`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/trip/{id}` | effective | Resumen JSON |
| GET | `/export/{id}?format&only_billable&from&to` | effective | CSV |
| GET | `/export/{id}/bundle?only_billable&from&to` | effective | ZIP con CSV + imágenes |

### Currencies (`/api/currencies`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/rates` | user | Tipos de cambio del día base→common currencies |
| GET | `/convert?amount&from_currency&to_currency&rate_date?` | user | Convertir |

### Lookup (`/api/airports`, `/api/airlines`, `/api/places`)

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/airports/search?q=` | user | Búsqueda en CSV OpenFlights |
| GET | `/airlines/search?q=` | user | Búsqueda en CSV airlines.csv |
| GET | `/places/hotels?q=` | user | Búsqueda Nominatim (alojamientos) |

### Otros

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET/POST/DELETE | `/api/loyalty-cards`, `/{id}` | mixto | CRUD |
| GET/POST/DELETE | `/api/payment-methods`, `/{id}` | mixto | CRUD |
| GET/POST/PUT | `/api/notifications`, `/count`, `/read-all`, `/{id}/read` | mixto | CRUD |
| POST | `/api/email/poll-now` | user | Procesa IMAP ahora |
| POST | `/api/email/test-connection` | user | Test conexión IMAP |
| POST | `/api/webhooks/email` | `X-Webhook-Secret` | Push de email de viaje |
| GET | `/health` | público | `SELECT 1` |

---

## 7. Modelos de Datos (Diagrama de Relaciones)

```
┌─────────────────┐
│      users      │
│  id (UUID)      │◄──┐
│  email          │   │
│  password_hash  │   │
│  is_admin       │   │ guest_of
│  is_guest       │   │ invited_by
│  is_active      │   │ (self-refs)
│  invite_token   │   │
│  guest_of  ─────┼───┘
│  invited_by─────┼───┘
└────────┬────────┘
         │ 1 : N
         │
         ├─────────────────────┬─────────────────────┬─────────────────────┐
         │                     │                     │                     │
         ▼                     ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│      trips      │   │  loyalty_cards  │   │ payment_methods │   │  notifications  │
│  user_id ──────┐│   │  user_id ──────┐│   │  user_id ──────┐│   │  user_id ──────┐│
└────────┬───────┴┘   └────────┬───────┴┘   └────────┬───────┴┘   └────────┬───────┴┘
         │ 1 : N               │                     │                     │
         │                     │                     │                     │
         ├─────────────────────┤                     │                     │
         │                     │                     │                     │
         ▼                     ▼                     │                     │
┌─────────────────┐   ┌─────────────────┐            │                     │
│    expenses     │   │   trip_legs     │            │                     │
│  trip_id ──────┐│   │  trip_id?─────┐ │            │                     │
│  user_id ──────┘│   │  user_id?─────┘ │            │                     │
│  loyalty_card_id┼──►│  mode           │            │                     │
│  payment_method_│   │  expense_id ────┼─┐          │                     │
│   id (FK SET)   │   │  loyalty_card_id│ │          │                     │
│  is_draft       │   │  source         │ │          │                     │
│  paperless_doc  │   │  confirmed      │ │          │                     │
│  local_path     │   └─────────────────┘ │          │                     │
│  amount_base    │           ▲           │          │                     │
│  ocr_*          │           └───────────┘          │                     │
└────────┬────────┘    (expense_id → expenses)        │                     │
         │                                            │                     │
         │             ┌─────────────────┐            │                     │
         └────────────►│                 │◄───────────┘                     │
                       │  payment_method │                                  │
                       └─────────────────┘                                  │
                                                                            │
┌─────────────────┐   ┌─────────────────┐                                   │
│     settings    │   │  email_imports  │                                   │
│  user_id (CASC) │   │  user_id (CASC) │                                   │
│  key,value      │   │  message_id (U) │                                   │
│  UNIQUE(uid,key)│   │  legs_created   │                                   │
└─────────────────┘   └─────────────────┘                                   │
                                                                            │
┌─────────────────┐                                                         │
│ exchange_rates  │                                                         │
│  from, to, rate │                                                         │
│  UNIQUE(f,t,d)  │                                                         │
└─────────────────┘                                                         │
                                                                            │
                                                                            │
ON DELETE behaviour:                                                        │
- users → trips, expenses, settings, loyalty_cards, payment_methods,        │
         notifications, email_imports : CASCADE                             │
- users → users (guest_of, invited_by) : SET NULL                           │
- trips → expenses : CASCADE                                                │
- trips → trip_legs : CASCADE (trip_id nullable para pending)               │
- expenses → trip_legs.expense_id : SET NULL                                │
- loyalty_cards → expenses.loyalty_card_id : SET NULL                       │
- loyalty_cards → trip_legs.loyalty_card_id : SET NULL                      │
- payment_methods → expenses.payment_method_id : SET NULL                   │
```

Volúmenes y artefactos en disco:

```
/app/uploads/
├── {user_id}/                       ← imágenes de gastos (Flujo A y B fallback)
│   └── {expense_id}.{jpg|png|webp|pdf}
├── covers/                          ← portadas de viaje
│   └── {trip_id}.jpg
└── legs/                            ← documentos adjuntos a tramos
    └── {leg_id}.{jpg|png|webp|pdf}
```

> `Expense.local_path`, `Trip.cover_image_path`, `TripLeg.document_path`
> almacenan estas rutas. **Nunca se serializan al cliente** — los schemas Read
> los marcan `exclude=True` y exponen flags `has_receipt` / `has_document`.

---

> **Fin del documento.** Si has hecho un cambio que invalide algo aquí,
> actualiza esta página antes de commitear. La fuente de verdad para reglas
> del proyecto sigue siendo `CLAUDE.md`.
