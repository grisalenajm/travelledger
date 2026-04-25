# TODO.md — Ledger / Travel Expenses App

> Lista maestra de tareas para agentes Claude Code.
> **Leer `CLAUDE.md` y `MEMORY.md` antes de empezar.**
> Al completar una tarea: marcar `[x]` aquí **y** actualizar `MEMORY.md`.

---

## 📋 Leyenda

```
[ ] — pendiente
[x] — completado
[~] — en progreso (anotar agente y fecha)
[!] — bloqueante: otros agentes no pueden avanzar hasta que esté hecho
[✗] — descartado permanentemente (con razón anotada)
```

**Agentes disponibles:**
- `[Infra]` — Docker, infraestructura, CI
- `[BE]` — Backend FastAPI
- `[Web]` — Frontend Next.js
- `[And]` — Android Kotlin/Compose
- `[OCR]` — Servicio OCR / integración Paperless
- `[Bot]` — Bot Telegram

---

## 🏗️ Arquitectura de despliegue (FIJA)

```
NAS UGREEN
├── postgres-ledger       → BD exclusiva Ledger (puerto 5433, DB "ledger")
│                           NO es postgres-vectorchord
├── paperless-ngx         → almacén de imágenes/facturas
└── nginx-proxy-manager   → proxy inverso TLS

LXC Proxmox (768 MB RAM, nesting)
└── docker-compose.yml
    ├── backend   (FastAPI)
    ├── frontend  (Next.js standalone)
    └── bot       (PTB + Haiku)
```

**Servicios eliminados — no recrear:**
- `[✗]` PostgreSQL propio en LXC → usar postgres-ledger del NAS (puerto 5433)
- `[✗]` MinIO → imágenes van a Paperless-ngx
- `[✗]` Paperless-ngx propio → usar el del NAS vía API REST
- `[✗]` Ollama → usar Claude Haiku 4.5 API
- `[✗]` Tesseract → usar Claude Haiku 4.5 Vision
- `[✗]` Integración Uber → descartada (no hay API pública gratuita)

---

## ✅ FASE 0 — Infraestructura `[Infra]` `[BE]` `[Web]` `[And]` *(COMPLETADA 2026-04-24)*

### Infra
- [x] [!] `docker-compose.yml` — 3 servicios: backend, frontend, bot
- [x] [!] `docker-compose.dev.yml` — hot-reload para los 3
- [x] [!] `.env.example` — todas las variables con `DATABASE_URL` apuntando a NAS:5433
- [x] [!] `nas-postgres-ledger.yml` — fragmento para añadir al compose del NAS
- [x] `secrets/` en `.gitignore` (firebase-credentials.json)
- [x] Healthcheck en cada servicio del LXC
- [ ] README: instrucciones para levantar postgres-ledger en el NAS antes de arrancar

### Backend skeleton
- [x] [!] `backend/app/main.py` — FastAPI app, CORS desde `ALLOWED_ORIGINS`, routers, `/health`
- [x] [!] `backend/app/config.py` — Settings Pydantic (sin MinIO, sin Ollama)
- [x] [!] `backend/app/database.py` — AsyncSession, engine, `get_db`
- [x] Alembic init + primera migration vacía
- [x] `backend/Dockerfile` — multi-stage, imagen slim, sin Tesseract
- [x] `requirements.txt` — sin boto3, sin pytesseract, sin ollama

### Frontend skeleton
- [x] [!] Proyecto Next.js 14 App Router en `/frontend`
- [x] shadcn/ui init + Tailwind config con tokens del design system
- [x] Fuentes Manrope + Public Sans en `layout.tsx`
- [x] Material Symbols Outlined en `layout.tsx`
- [x] `lib/api.ts` — cliente HTTP base con interceptor JWT
- [x] `frontend/Dockerfile` — multi-stage con `output: standalone`

### Bot skeleton
- [x] `bot/Dockerfile` — Python 3.12-slim, multi-stage
- [x] `bot/main.py` — PTB Application, webhook/polling, health server :8080
- [x] `bot/config.py` — BotSettings Pydantic
- [x] `bot/handlers/` — commands, message, photo, callback (stubs)
- [x] `bot/llm_service.py` — Haiku 4.5 stub
- [x] `bot/ledger_client.py` — httpx async
- [x] `bot/session.py` — ChatSession con TTL 30min
- [x] `bot/trip_resolver.py` — cascada viaje activo
- [x] `bot/prompts/` — classify, extract_expense, query

### Android skeleton
- [ ] [!] Proyecto Android en `/android/` con estructura de módulos
- [ ] Hilt configurado
- [ ] Compose BOM + Material 3
- [ ] `LedgerTheme.kt` con tokens del design system (ver `DESIGN_SYSTEM.md`)
- [ ] Navigation graph vacío
- [ ] `NetworkModule.kt` — Retrofit + OkHttp skeleton

### Datos seed
- [ ] Script SQL con categorías por defecto:
      Dining, Lodging, Transport, Culture, Shopping, Health, Other

---

## 🟠 FASE 1 — Autenticación `[BE]` `[Web]` `[And]` *(EN PROGRESO)*

### Backend
- [x] [!] Modelo `User` + migration
      (campos: `id, email, name, password_hash, currency_base, fcm_token, telegram_chat_id`)
- [x] [!] Schemas: `UserCreate`, `UserLogin`, `UserRead`, `UserUpdate`, `Token`, `TokenRefresh`, `DeviceRegister`
- [x] [!] `core/security.py` — bcrypt, JWT access 30min / refresh 7d
- [x] [!] Router `/api/auth`: register, login, refresh, logout, device (FCM)
- [x] [!] Router `/api/users`: GET/PUT /me
- [x] [!] Dependency `get_current_user`
- [x] Tests: `test_auth_*`, `test_jwt_*`

### Web
- [x] NextAuth.js con provider `credentials`
- [x] Páginas `/login` y `/register`
- [x] Store Zustand `useAuthStore`
- [x] Middleware Next.js — redirige a `/login` si no hay sesión
- [x] Manejo 401 en `lib/api.ts` → logout

### Android
- [ ] `LoginScreen.kt` + `LoginViewModel.kt` + `LoginUiState`
- [ ] `AuthRepository.kt` — login, register, refreshToken, logout
- [ ] `AuthInterceptor.kt` — attach JWT + retry en 401
- [ ] `TokenStore.kt` — DataStore cifrado
- [ ] `SplashScreen.kt` — check sesión activa

---

## 🟡 FASE 2 — CRUD Trips, Legs, Expenses & Loyalty Cards `[BE]` `[Web]` `[And]`

### Backend
- [ ] [!] Modelos + migrations:
  - [ ] `LoyaltyCard` (user_id, program_name, program_type, membership_number, tier, alias)
  - [ ] `Trip` (user_id, name, description, destination, start/end_date,
               **primary_currency OBLIGATORIO**, budget, budget_currency, status)
  - [ ] `TripLeg` (trip_id, mode, origin, destination, departure_local, arrival_local,
                   carrier, reservation_number, locator_code, loyalty_card_id, notes)
  - [ ] `Expense` (trip_id, user_id, amount, currency, amount_base, rate_date,
                   category, description, date, payment_method,
                   **billable DEFAULT True**, loyalty_card_id, paperless_doc_id)
  - [ ] `ExchangeRate` (from, to, rate, date — UNIQUE por par+fecha)
- [ ] [!] Router `/api/loyalty-cards` — CRUD completo
- [ ] [!] Router `/api/trips` — CRUD + GET summary
- [ ] [!] Router `/api/trips/{id}/legs` — CRUD completo
- [ ] [!] Router `/api/expenses` — CRUD completo
- [ ] `loyalty_card_service.py`
- [ ] `trip_service.py`
- [ ] `leg_service.py`
- [ ] `expense_service.py` — incluye conversión de moneda al crear/actualizar
- [ ] `currency_service.py`:
  - [ ] `GET /api/currencies/rates`
  - [ ] `GET /api/currencies/convert`
  - [ ] Cache en `ExchangeRate` (fuente: exchangerate.host, 1 vez/día por par)
  - [ ] `convert(amount, from_currency, to_currency, date)` → Decimal
- [ ] Tests: `test_trip_service_*`, `test_expense_service_*`, `test_currency_service_*`

### Web
- [ ] Página `/trips` — lista de viajes con card editorial por viaje
- [ ] Página `/trips/new` — formulario (nombre, destino, fechas, primary_currency OBLIGATORIO,
                                        presupuesto, budget_currency, descripción)
- [ ] Página `/trips/[id]` — detalle:
  - [ ] Header editorial con nombre del viaje y totales
  - [ ] Grid 3 col de `ExpenseCard` (ver `DESIGN_SYSTEM.md`)
  - [ ] Sección de tramos del viaje (TripLeg cards)
  - [ ] Filtros: categoría, fecha, billable/todos
  - [ ] FAB "Quick Entry" (Flujo A)
  - [ ] Botón "Escanear" (Flujo B)
- [ ] Página `/` (Dashboard):
  - [ ] Header "Current Journey" + barra de progreso (en currency_base)
  - [ ] Bento stats: Budget / Spent / Remaining (todos en currency_base)
  - [ ] Chart donut "Spending Architecture"
  - [ ] Side card "Pending Receipts"
- [ ] Página `/settings/cards` — gestión de loyalty cards
- [ ] Modal `AddExpenseForm` — Flujo A (campos + imagen opcional)
- [ ] Hooks: `useTrips()`, `useExpenses(tripId)`, `useLoyaltyCards()` con React Query

### Android
- [ ] Room entities + DAOs: `TripEntity`, `TripLegEntity`, `ExpenseEntity`, `LoyaltyCardEntity`
- [ ] Repositories offline-first: `TripRepository`, `ExpenseRepository`, `LoyaltyCardRepository`
- [ ] Pantallas: TripList, TripDetail, TripLegs, ExpenseList, AddExpense
- [ ] `AddExpenseScreen.kt` — campos: importe, moneda (pre-filled con primary_currency),
                               categoría, fecha, descripción, billable toggle, loyalty card
- [ ] `LoyaltyCardsScreen.kt` — lista + alta de tarjetas de viajero frecuente
- [ ] Bottom navigation: Dashboard / Trips / Scan / Settings
- [ ] `DashboardScreen.kt` — totales en currency_base

---

## 🟢 FASE 3 — OCR & Scanner `[OCR]` `[Web]` `[And]`

### Backend OCR
- [ ] [!] Modelo `Receipt` + migration
      (sin storage_path — solo paperless_doc_id, ocr_data JSON, haiku_cost_usd)
- [ ] [!] `services/ocr_service.py`:
  - [ ] Haiku 4.5 Vision con prompt caching (cache_control ephemeral)
  - [ ] Validación MIME por magic bytes (jpeg, png, webp, gif, pdf)
  - [ ] Subida a Paperless-ngx del NAS
  - [ ] Devuelve OcrResultDto con receipt_id y paperless_doc_id
  - [ ] Registra haiku_cost_usd en Receipt para monitoring
- [ ] [!] `services/paperless_service.py`:
  - [ ] `upload_document(file_bytes, filename, mime_type, title)` → doc_id
  - [ ] `get_document_url(doc_id)` → URL directa
  - [ ] `delete_document(doc_id)`
  - [ ] Manejo de task_id para Paperless v1.17+
- [ ] [!] Router `POST /api/receipts/upload` — Flujo B
  - [ ] Flujo A: POST /api/expenses con imagen adjunta (sin OCR, solo upload a Paperless)
- [ ] Tests con fixtures de tickets (mockear Anthropic API y Paperless)

### Web
- [ ] Página `/expenses/scan` — `<ReceiptScanner>` drag&drop + file + cámara
- [ ] Página `/expenses/scan/confirm` — layout 5/7, preview + formulario pre-rellenado
      (ver `DESIGN_SYSTEM.md` — pantalla ya definida en el stitch)

### Android
- [ ] `ScannerScreen.kt` — CameraX full-screen + overlay viewfinder + scanning line
- [ ] `ScannerViewModel.kt`:
  - [ ] Path principal: foto → POST /api/receipts/upload → Haiku en backend
  - [ ] Fallback offline: ML Kit on-device si no hay conexión (resultado provisional)
  - [ ] Al recuperar conexión: re-enviar al backend para OCR completo
- [ ] `ConfirmExpenseScreen.kt` — formulario editable + guardar
- [ ] FAB "Escanear" en TripDetailScreen

---

## 🔵 FASE 4 — Paperless-ngx integración completa `[OCR]` `[Web]` `[And]`

### Backend
- [ ] [!] `expense_service.delete()` — cascade: borrar documento en Paperless al borrar gasto
- [ ] Tests con mock de Paperless API

### Web
- [ ] Botón "Ver factura" en ExpenseCard y en detalle de gasto
- [ ] Abre URL de Paperless en nueva pestaña (`target="_blank"`)
- [ ] Sin `paperless_doc_id`: botón deshabilitado con tooltip "Sin factura"

### Android
- [ ] Botón "Ver factura" en detalle del gasto
- [ ] `Intent.ACTION_VIEW` al navegador del sistema
- [ ] Sin `paperless_doc_id`: botón oculto

---

## 🟣 FASE 5 — Offline Sync Android `[BE]` `[And]`

### Backend
- [ ] [!] Modelo `PendingOperation` + migration
- [ ] [!] `POST /api/sync/push` — idempotente por `operation_id`
      (soporta legs: create_leg, update_leg, delete_leg)
- [ ] [!] `GET /api/sync/pull?since=` — devuelve trips, legs, expenses, deleted_ids
- [ ] Tests de idempotencia

### Android
- [ ] `PendingOperationEntity.kt` + DAO
- [ ] Patrón write-through en todos los repositorios (Trip, TripLeg, Expense)
- [ ] `SyncWorker.kt` — WorkManager con `NetworkType.CONNECTED`
- [ ] Indicador visual "pendiente de sync" en gastos con `syncPending = true`

---

## 🟤 FASE 6 — Reports & Export Bundle `[BE]` `[Web]` `[And]`

### Backend
- [ ] `export_service.py`:
  - [ ] `export_csv(trip_id, user_id, only_billable, date_from, date_to)` → StringIO
        Columnas: date, description, category, billable, payment_method, loyalty_card,
        amount, currency, amount_base, base_currency, exchange_rate, rate_date,
        paperless_url, image_file
        BOM UTF-8, decimales con punto, fechas ISO 8601, vacíos como ""
  - [ ] `export_bundle(trip_id, user_id, only_billable, date_from, date_to)` → BytesIO (ZIP)
        Descarga imágenes de Paperless al vuelo
        Naming: `{category}_{date}_{merchant-slug}.{ext}` (todo plano, sin subcarpetas)
        ZIP contiene: gastos_{trip}.csv + todas las imágenes
- [ ] Router `reports.py`:
  - [ ] `GET /api/reports/trip/{id}` → breakdown categorías + totales en base currency
  - [ ] `GET /api/reports/export/{id}?format=csv`
  - [ ] `GET /api/reports/export/{id}/bundle`
        params: `only_billable`, `from`, `to`
- [ ] Tests: `test_export_csv_*` y `test_export_bundle_*` con fixtures conocidos

### Web
- [ ] Página `/reports` — gráfico barras por categoría + evolución diaria + tabla resumen
- [ ] Modal "Exportar" en `/trips/[id]`:
  - [ ] Toggle: solo facturables / todos
  - [ ] Selector rango de fechas opcional
  - [ ] Botón "Descargar CSV"
  - [ ] Botón "Descargar ZIP (CSV + facturas)"
- [ ] Hook `useExportCsv(tripId)` — fetch → blob → descarga nativa
- [ ] Hook `useExportBundle(tripId)` — fetch → blob ZIP → descarga nativa

### Android
- [ ] `ReportsScreen.kt` + `ReportsViewModel.kt`
- [ ] `exportAndShareCsv(tripId, context)` — bytes → cacheDir → FileProvider → share sheet
- [ ] `exportAndShareBundle(tripId, context)` — ZIP → cacheDir → FileProvider → share sheet
- [ ] `FileProvider` en AndroidManifest + `file_paths.xml`
- [ ] Botón "Compartir CSV" y "Compartir ZIP" en pantalla de resumen del viaje

---

## ⚫ FASE 7 — Push Notifications & Polish `[BE]` `[Web]` `[And]`

### FCM Backend
- [ ] Modelo `PushDevice` + migration
- [ ] `push_service.py` con `firebase-admin`
- [ ] Trigger en `expense_service.create()`: alerta al superar 80% y 100% del presupuesto

### Android Polish
- [ ] `FirebaseMessagingService.kt`
- [ ] Registrar FCM token en login (`POST /api/auth/device`)
- [ ] Dynamic color (Material You, SDK ≥ 31)
- [ ] Animaciones de transición entre pantallas (`AnimatedNavHost`)
- [ ] Glance Widget — gasto rápido desde pantalla de inicio
- [ ] Tests UI con `createComposeRule()`

### Web Polish
- [ ] Responsive review completo (mobile breakpoints)
- [ ] Dark mode — variables CSS en `globals.css`
- [ ] Internacionalización ES/EN con `next-intl`
- [ ] E2E tests básicos con Playwright:
  - [ ] Login → crear viaje → añadir gasto manual
  - [ ] Subir imagen → confirmar OCR → ver gasto
  - [ ] Exportar CSV

---

## 🤖 FASE 8 — Bot Telegram `[Bot]` `[BE]`

> Prerrequisitos: Fases 0, 1 y 2 completadas.
> Haiku 4.5 para todo — sin Ollama, sin routing.

### Infra
- [ ] `bot/Dockerfile` — Python 3.12-slim

### Backend
- [ ] [!] `POST /api/bot/link` — vincula telegram_chat_id
- [ ] `GET /api/bot/context/{chat_id}` — viaje activo + user_id

### Bot
- [ ] [!] `bot/main.py` — PTB Application, webhook (prod) / polling (dev)
- [ ] [!] `bot/config.py`
- [ ] [!] `bot/ledger_client.py` — httpx async, auth por BOT_API_KEY
- [ ] [!] `bot/session.py` — contexto en memoria, TTL 30min
- [ ] [!] `bot/llm_service.py` — Haiku 4.5 con prompt caching:
  - [ ] `classify_intent(text)` → create | query | export | set_trip | unknown
  - [ ] `extract_expense(text)` → JSON estructurado
  - [ ] `answer_query(text, context)` → lenguaje natural
- [ ] `bot/trip_resolver.py` — cascada viaje activo
- [ ] `bot/handlers/commands.py` — /start, /viaje, /viajes, /resumen, /ayuda
- [ ] `bot/handlers/message.py` — texto libre → Haiku → intent → acción
- [ ] `bot/handlers/photo.py` — Flujo B desde Telegram
- [ ] `bot/handlers/callback.py` — inline keyboards ✅ ✏️ ❌
- [ ] Export CSV y bundle ZIP desde comandos en lenguaje natural
- [ ] `bot/prompts/extract_expense.txt`
- [ ] `bot/prompts/classify.txt`
- [ ] `bot/prompts/query.txt`
- [ ] Tests: `test_llm_service.py`, `test_handlers.py`, `test_trip_resolver.py`

---

## 🎨 Pantallas sin diseño en stitch (mantener tokens del DESIGN_SYSTEM.md)

- [ ] Login / Register (Web + Android)
- [ ] Lista de viajes `/trips` — cards con nombre, destino, fechas, % presupuesto en currency_base
- [ ] Nuevo viaje `/trips/new` — date range picker, selector primary_currency obligatorio
- [ ] Tramos del viaje `/trips/[id]/legs` — cards por tramo con icono de modo de transporte,
      horarios locales, carrier, localizador, loyalty card asociada
- [ ] Loyalty cards `/settings/cards` — lista con program_type badge, número enmascarado, tier
- [ ] Modal export en `/trips/[id]` — toggle billable/todos, date range, botones CSV y ZIP
- [ ] Reports `/reports` — gráficos + tabla con totales en currency_base
- [ ] Settings `/settings` — moneda base, vinculación Telegram, notificaciones

---

## 🗂️ Fase 9 — Backlog / Investigación

- [ ] OCR de confirmaciones de vuelo para crear TripLeg automáticamente
      (mismo pipeline Haiku, prompt diferente orientado a datos de viaje)
      Requiere: definir prompt, endpoint `POST /api/trips/{id}/legs/parse`
- [ ] `[✗]` Integración Uber — descartada. No existe API pública gratuita para usuarios individuales.
      La Uber for Business API requiere acuerdo corporativo.

---

## 🐛 Bugs conocidos

*(ninguno aún)*

---

## 📌 Notas para agentes

1. Orden de lectura obligatorio al iniciar: `CLAUDE.md` → `MEMORY.md` → `DESIGN_SYSTEM.md` → este archivo.
2. Al completar una tarea: marcar `[x]` aquí y actualizar `MEMORY.md`.
3. Al encontrar un bug: añadir a "Bugs conocidos" con descripción y contexto.
4. Si cambia un endpoint: actualizar `CLAUDE.md` sección API y notificar en `MEMORY.md`.
5. Nunca avanzar una fase sin que sus bloqueantes `[!]` estén completos.
6. OCR: siempre Haiku 4.5. Flujo A (manual) nunca dispara OCR.
7. Storage: siempre Paperless-ngx del NAS. Nunca MinIO, nunca disco local.
8. BD: siempre `postgres-ledger` del NAS (puerto 5433). Nunca contenedor propio en el LXC.
9. Monedas: dos niveles — transaccional (lo que se pagó) y base (User.currency_base).
10. `billable` por defecto `True`. `primary_currency` obligatorio al crear viaje.
