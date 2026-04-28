# TODO.md — Ledger / Travel Expenses App

> Lista maestra de tareas para agentes Claude Code.
> **Leer `CLAUDE.md` y `MEMORY.md` antes de empezar.**
> Al completar una tarea: marcar `[x]` aquí **y** actualizar `MEMORY.md`, `CLAUDE.md`, `BEST_PRACTICES.md`.

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
NAS UGREEN (192.168.1.154)
├── postgres-ledger       → BD exclusiva Ledger (puerto 5433, DB "ledger")
├── paperless-ngx         → almacén de imágenes/facturas
└── nginx-proxy-manager   → proxy inverso TLS

LXC Proxmox (192.168.1.125, 768 MB RAM, nesting)
└── /opt/ledger/docker-compose.yml
    ├── backend   (FastAPI :8000)
    ├── frontend  (Next.js :3000)
    └── bot       (PTB :8080 health)
```

**Servicios eliminados — no recrear:**
- `[✗]` PostgreSQL propio en LXC → usar postgres-ledger del NAS (puerto 5433)
- `[✗]` MinIO → imágenes van a Paperless-ngx
- `[✗]` Paperless-ngx propio → usar el del NAS vía API REST
- `[✗]` Ollama → usar Claude Haiku 4.5 API
- `[✗]` Tesseract → usar Claude Haiku 4.5 Vision
- `[✗]` Integración Uber → descartada (no hay API pública gratuita)

---

## ✅ FASE 0 — Infraestructura *(COMPLETADA 2026-04-24)*

- [x] `docker-compose.yml` — 3 servicios: backend, frontend, bot
- [x] `docker-compose.dev.yml` — hot-reload para los 3
- [x] `.env.example` — variables con `DATABASE_URL` apuntando a NAS:5433
- [x] `nas-postgres-ledger.yml` — fragmento para el NAS
- [x] Healthcheck en cada servicio del LXC
- [x] Deploy verificado — 3 servicios healthy en 192.168.1.125
- [x] Backend skeleton — FastAPI, CORS, routers, /health, Alembic
- [x] Frontend skeleton — Next.js 14, shadcn tokens, Manrope/Public Sans
- [x] Bot skeleton — PTB, handlers stub, llm_service stub, trip_resolver
- [ ] README: instrucciones para levantar postgres-ledger en el NAS
- [ ] Android skeleton — proyecto /android/, Hilt, Compose BOM, Navigation
- [ ] Seed SQL — categorías: Dining, Lodging, Transport, Culture, Shopping, Health, Other

---

## ✅ FASE 1 — Autenticación *(Backend + Web COMPLETADOS 2026-04-24)*

### Backend ✅
- [x] Modelo `User` + migration `0001_create_users`
- [x] Schemas: UserCreate, UserLogin, UserRead, UserUpdate, Token, TokenRefresh
- [x] `core/security.py` — bcrypt, JWT access 30min / refresh 7d
- [x] `core/limiter.py` — SlowAPI con no-op para tests
- [x] `core/dependencies.py` — get_current_user, verify_bot_request (HMAC-SHA256)
- [x] Router `/api/auth` — register, login, refresh, logout, device
- [x] Router `/api/users` — GET/PUT /me
- [x] Hardening: rate limits, security headers, CORS explícito, openapi_url=None en prod
- [x] Tests: test_auth_*, test_jwt_*

### Web ✅
- [x] NextAuth.js con provider credentials + refreshAccessToken automático
- [x] Páginas /login y /register con design system
- [x] Zustand useAuthStore
- [x] Middleware — redirige a /login si no hay sesión
- [x] Proxy /api/proxy/* con req.text() (evita detached ArrayBuffer)
- [x] lib/api.ts — auto-JWT + 401→signOut

### Android `[And]`
- [ ] LoginScreen.kt + LoginViewModel.kt
- [ ] AuthRepository.kt — login, register, refreshToken, logout
- [ ] AuthInterceptor.kt — attach JWT + retry en 401
- [ ] TokenStore.kt — DataStore cifrado
- [ ] SplashScreen.kt — check sesión activa

---

## ✅ FASE 2 — CRUD Trips, Legs, Expenses & Loyalty Cards

### Backend ✅ *(2026-04-25 — 27/27 tests)*
- [x] Modelos: LoyaltyCard, Trip, TripLeg, Expense, ExchangeRate
- [x] Migration 0002_create_core_models aplicada
- [x] Schemas: loyalty_card, trip (TripSummary incluido), trip_leg, expense, currency
- [x] currency_service.py — open.er-api.com, cache en ExchangeRate
- [x] loyalty_card_service.py, trip_service.py, leg_service.py, expense_service.py
- [x] Routers: /api/loyalty-cards, /api/trips, /api/trips/{id}/legs, /api/expenses, /api/currencies
- [x] Tests: test_trips, test_expenses, test_currency, test_loyalty_cards

### Web ✅ *(2026-04-26)*
- [x] types/ledger.ts — tipos completos del dominio
- [x] Hooks React Query: useTrips, useExpenses, useLoyaltyCards
- [x] Componentes UI propios (sin Radix): badge, progress, button, dialog, switch, label
- [x] trip-card.tsx, expense-card.tsx, add-expense-modal.tsx
- [x] /trips — lista con filtros de status
- [x] /trips/new — formulario con primary_currency obligatorio
- [x] /trips/[id] — detalle con summary, tabs gastos/tramos
- [x] / (dashboard) — viaje activo + últimos gastos
- [x] /settings/cards — loyalty cards CRUD

### Web `[Web]` — UX pendiente *(revisión 2026-04-26)*
- [x] Navbar global: logo→/, Viajes→/trips, Tarjetas→/settings/cards, avatar→/settings (activo en todo /settings/*), signOut
- [x] Breadcrumb/botón "← Viajes" en /trips/[id]
- [x] /settings/profile — editar nombre y currency_base, PUT /api/users/me
- [x] Detalle/edición de gasto — doble clic en ExpenseCard → /trips/[id]/expenses/[expenseId] con edición completa y eliminación con confirmación
- [x] Barra de totales por moneda en trip detail — chip base (budget_currency) + chips por moneda, reactiva al filtro de día
- [x] Edición de viaje — /trips/[id]/edit con cover image, todos los campos, eliminación con 2-step confirm; botón edit en trip detail header
- [x] Imagen de portada de viaje — POST /api/trips/{id}/cover (magic-bytes MIME, Paperless upload + task polling); GET /api/trips/{id}/cover-url; migration 0003
- [x] Adjuntar imagen a gasto en Flujo A (sin OCR) → backend → Paperless → paperless_doc_id
- [x] Web: campo comprobante en AddExpenseModal (file picker, preview, multipart submit via /api/proxy/expenses/ con trailing slash)
- [x] Ver comprobante desde detalle de gasto — GET /api/expenses/{id}/receipt-url + paperless_service.get_url()
- [x] Export CSV del viaje — GET /api/reports/export/{id}?format=csv + botón "Exportar CSV" en trip detail
- [x] Selector de días deslizante en trip detail — chips "T" + día por día, filtra gastos por fecha
- [ ] Fix confirm_password en /register

### Android `[And]`
- [ ] Room entities + DAOs: Trip, TripLeg, Expense, LoyaltyCard
- [ ] Repositories offline-first
- [ ] Pantallas: TripList, TripDetail, TripLegs, ExpenseList, AddExpense, LoyaltyCards
- [ ] Bottom navigation: Dashboard / Trips / Scan / Settings
- [ ] DashboardScreen.kt — totales en currency_base

---

## 🟢 FASE 3 — OCR & Scanner `[OCR]` `[Web]` `[And]`

### Pre-requisitos (completados)
- [x] Modelo `Setting` + migration `0004_create_settings`
- [x] `settings_service.py` — get_all, get, set (upsert PostgreSQL)
- [x] Router `/api/settings` — GET, PUT, POST /verify-paperless
- [x] `paperless_service.py` — credenciales per-user desde BD; upload_document, get_url, verify_connection; título {category}_{date}_{trip_slug}; etiqueta "travel" auto-creada en Paperless

### Backend
- [ ] [!] Modelo Receipt + migration
- [ ] [!] services/ocr_service.py — Haiku 4.5 Vision + prompt caching + Paperless upload
- [ ] [!] Router POST /api/receipts/upload — Flujo B
- [x] Router POST /api/expenses con imagen — Flujo A (sin OCR, solo Paperless)
- [ ] Tests con fixtures (mockear Anthropic API y Paperless)

### Web
- [x] /settings — página unificada: Perfil (nombre + currency_base) + Integraciones → Paperless (URL, token con toggle, verificar conexión)
- [x] hooks/use-settings.ts — useSettings() GET + useUpdateSetting() PUT
- [ ] /expenses/scan — drag&drop + file + cámara
- [ ] /expenses/scan/confirm — layout 5/7, pre-rellenado OCR

### Android
- [ ] ScannerScreen.kt — CameraX + overlay
- [ ] ScannerViewModel.kt — path principal backend, fallback ML Kit offline
- [ ] ConfirmExpenseScreen.kt

---

## 🔵 FASE 4 — Paperless-ngx integración `[OCR]` `[Web]` `[And]`

- [ ] [!] expense_service.delete() — cascade borrado en Paperless
- [x] Web: botón "Ver factura" en expense detail page (Comprobante clickable)
- [ ] Android: botón "Ver factura" con Intent.ACTION_VIEW

---

## 🟣 FASE 5 — Offline Sync Android `[BE]` `[And]`

- [ ] [!] Modelo PendingOperation + migration
- [ ] [!] POST /api/sync/push — idempotente por operation_id
- [ ] [!] GET /api/sync/pull?since= — trips, legs, expenses, deleted_ids
- [ ] SyncWorker.kt — WorkManager NetworkType.CONNECTED
- [ ] Write-through en todos los repositorios Android

---

## 🟤 FASE 6 — Reports & Export Bundle `[BE]` `[Web]` `[And]`

- [ ] export_service.py — CSV (BOM UTF-8) + ZIP con imágenes de Paperless
- [ ] Naming ZIP: {category}_{date}_{merchant-slug}.{ext} (plano, sin subcarpetas)
- [ ] Router: GET /api/reports/trip/{id}, /export/{id}?format=csv, /export/{id}/bundle
- [ ] Web: modal export con toggle billable + date range + botones CSV y ZIP
- [ ] Android: share sheet CSV y ZIP via FileProvider

---

## ⚫ FASE 7 — Push Notifications & Polish `[BE]` `[Web]` `[And]`

- [ ] Modelo PushDevice + migration
- [ ] push_service.py — alertas 80% y 100% presupuesto
- [ ] Android: FCM + Dynamic color + AnimatedNavHost + Glance Widget
- [ ] Web: dark mode + i18n ES/EN + E2E Playwright

---

## 🤖 FASE 8 — Bot Telegram `[Bot]` `[BE]`

- [ ] [!] POST /api/bot/link + GET /api/bot/context/{chat_id}
- [ ] bot/llm_service.py — Haiku 4.5 con prompt caching
- [ ] Handlers completos: commands, message, photo, callback
- [ ] Export CSV y bundle ZIP desde lenguaje natural
- [ ] Tests: llm_service, handlers, trip_resolver

---

## 🗂️ FASE 9 — Backlog

- [ ] OCR de confirmaciones de vuelo → crear TripLeg automático
- `[✗]` Integración Uber — descartada

---

## 🐛 Bugs conocidos

- `/register` no pide `confirm_password` — validar que coinciden antes de enviar

---

## 📌 Notas para agentes

1. Orden de lectura: `CLAUDE.md` → `MEMORY.md` → `BEST_PRACTICES.md` → este archivo.
2. Al completar: marcar `[x]`, actualizar `MEMORY.md`, `CLAUDE.md`, `BEST_PRACTICES.md`.
3. Al encontrar bug: añadir a "Bugs conocidos".
4. Al terminar: commit + push a GitHub → LXC: git pull + docker compose up --build.
5. Nunca avanzar una fase sin que sus bloqueantes `[!]` estén completos.
6. OCR: siempre Haiku 4.5. Flujo A nunca dispara OCR.
7. Storage: siempre Paperless-ngx del NAS.
8. BD: siempre postgres-ledger del NAS (192.168.1.154:5433).
9. `billable` DEFAULT True. `primary_currency` obligatorio al crear viaje.
10. Frontend: llamadas al backend siempre por /api/proxy/*, nunca directamente desde el navegador.
11. Currency service: usar open.er-api.com (gratuito, sin key). No usar exchangerate.host.
12. Rama git: siempre main. Nunca master.
