# TODO.md — Ledger / Travel Expenses App

> Lista maestra de tareas para agentes Claude Code.
> **Leer `CLAUDE.md` y `MEMORY.md` antes de empezar.**
> Al completar una tarea: marcar `[x]` aquí **y** actualizar `MEMORY.md`, `CLAUDE.md`, `BEST_PRACTICES.md`.
> Para tareas Android: ver `ANDROID_TODO.md` para desglose detallado.

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

### Backend — cambios requeridos por Android `[BE]`
- [x] [!] Añadir `REGISTRATION_INVITE_CODE` a `.env.example` y `config.py` *(2026-05-04)*
- [x] [!] Crear endpoint `POST /api/auth/validate-invite` — valida code antes del formulario de registro *(2026-05-04)*
- [x] [!] Modificar `UserCreate` schema: añadir `invite_code: str` obligatorio *(2026-05-04)*
- [x] [!] Modificar `POST /api/auth/register`: validar `invite_code` en el body *(2026-05-04)*
- [x] [!] Modificar `TripCreate` schema: añadir `id: UUID | None = None` *(2026-05-04)*
- [x] [!] Modificar `trip_service.create()`: respetar `id` del cliente si viene, generar si no *(2026-05-04)*
- [x] [!] Modificar `ExpenseCreate` schema: añadir `id: UUID | None = None` *(2026-05-04)*
- [x] [!] Modificar `expense_service.create()`: respetar `id` del cliente si viene, generar si no *(2026-05-04)*
- [x] [!] Idempotencia: POST con UUID ya existente del mismo usuario → 200/201 con recurso existente (no 409) *(2026-05-04)*
- [ ] Pendiente infra: rate limit en nginx-proxy-manager `/api/auth/register` → 3 req/hora por IP
- [ ] Implementar `GET /api/sync/pull?since={timestamp}` — ver FASE 5
- [ ] Implementar `POST /api/sync/push` idempotente — ver FASE 5

### Web ✅
- [x] NextAuth.js con provider credentials + refreshAccessToken automático
- [x] Páginas /login y /register con design system
- [x] Zustand useAuthStore
- [x] Middleware — redirige a /login si no hay sesión
- [x] Proxy /api/proxy/* con req.text() (evita detached ArrayBuffer)
- [x] lib/api.ts — auto-JWT + 401→signOut

### Web — cambios requeridos por Android `[Web]`
- [ ] Añadir campo `invite_code` al formulario `/register`
- [ ] Pasar `invite_code` en body de `POST /api/auth/register`
- [ ] Fix `confirm_password` en `/register` — validar que coinciden antes de enviar

### Android `[And]`
> Ver `ANDROID_TODO.md` Phase A1 y A2 para desglose completo.
- [ ] Phase A1 — Foundation (Gradle, Hilt, Room, Retrofit, Theme, Nav, Splash, Config)
- [ ] Phase A2 — Auth Flow (Login, Register, TokenStore, auto-login, logout)

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
- [x] Navbar global, breadcrumb, /settings/profile, edición de gasto
- [x] Barra de totales por moneda en trip detail
- [x] Edición de viaje — /trips/[id]/edit con cover image
- [x] Imagen de portada de viaje — POST /api/trips/{id}/cover
- [x] Adjuntar imagen a gasto (Flujo A) → Paperless → paperless_doc_id
- [x] Ver comprobante desde detalle de gasto
- [x] Export CSV del viaje — GET /api/reports/export/{id}?format=csv
- [x] Selector de días deslizante en trip detail

### Android `[And]`
> Ver `ANDROID_TODO.md` Phase A3 y A4 para desglose completo.
- [x] Phase A3 — Trip Management (TripsScreen, CreateTrip, TripRepository offline-first) *(2026-05-05)*
- [x] Phase A4 — Quick Capture (QuickCaptureScreen, ExpenseRepository, SyncWorker) *(2026-05-05)*

---

## 🟢 FASE 3 — OCR & Scanner `[OCR]` `[Web]` `[And]`

### Pre-requisitos (completados)
- [x] Modelo `Setting` + migration `0004_create_settings`
- [x] `settings_service.py` — get_all, get, set (upsert PostgreSQL)
- [x] Router `/api/settings` — GET, PUT, POST /verify-paperless
- [x] `paperless_service.py` — credenciales per-user desde BD

### Backend ✅
- [x] Sin modelo Receipt — OCR escribe directamente en Expense (is_draft=True) per CLAUDE.md
- [x] services/ocr_service.py — Haiku 4.5 Vision + prompt caching + Paperless upload
- [x] Router POST /api/receipts/upload — Flujo B (devuelve ExpenseRead)
- [x] Router POST /api/expenses con imagen — Flujo A (sin OCR, solo Paperless)
- [ ] Tests con fixtures (mockear Anthropic API y Paperless)

### Web
- [x] /settings — página unificada: Perfil + Integraciones → Paperless
- [x] hooks/use-settings.ts
- [ ] /expenses/scan — drag&drop + file + cámara
- [ ] /expenses/scan/confirm — layout 5/7, pre-rellenado OCR

### Android `[And]`
> Ver `ANDROID_TODO.md` Phase A5 para desglose completo.
- [x] Phase A5 — Camera + OCR (CameraScreen, CameraX, OcrProcessingScreen) *(2026-05-06)*

---

## 🔵 FASE 4 — Paperless-ngx integración `[OCR]` `[Web]` `[And]`

- [x] [!] expense_service.delete() — cascade borrado en Paperless *(2026-05-06)*
- [x] Web: botón "Ver factura" en expense detail page
- [ ] Android: botón "Ver factura" con Intent.ACTION_VIEW

---

## 🟣 FASE 5 — Offline Sync Android `[BE]` `[And]`

- [ ] [!] Modelo PendingOperation + migration (backend)
- [ ] [!] POST /api/sync/push — idempotente por operation_id
- [ ] [!] GET /api/sync/pull?since= — trips, legs, expenses, deleted_ids
- [ ] SyncWorker.kt — WorkManager NetworkType.CONNECTED, procesado por dependencias
- [ ] Write-through en todos los repositorios Android
- [ ] Backoff exponencial: 1min → 5min → 15min → 1h → 6h (max 5 intentos)
- [ ] Limpieza de ops `done` con más de 7 días

---

## 🟤 FASE 6 — Reports & Export Bundle `[BE]` `[Web]` `[And]`

- [x] export_service.py — CSV (BOM UTF-8) + ZIP con imágenes de Paperless *(2026-05-06)*
- [x] Naming ZIP: {category}_{date}_{merchant-slug}.{ext} (plano, sin subcarpetas) *(2026-05-06)*
- [x] Router: GET /api/reports/trip/{id}, /export/{id}?format=csv, /export/{id}/bundle *(2026-05-06)*
- [ ] Web: modal export con toggle billable + date range + botones CSV y ZIP
- [ ] Android: Phase A7 — SummaryScreen + export vía backend + FileProvider share sheet

---

## ⚫ FASE 7 — Push Notifications & Polish `[BE]` `[Web]` `[And]`

- [ ] Modelo PushDevice + migration
- [ ] push_service.py — alertas 80% y 100% presupuesto
- [ ] Android Phase A8: FCM + dark mode + animaciones + Glance Widget
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
- [ ] Android Phase A8: TripLegs, Loyalty Cards, BYOK OCR, biometría
- `[✗]` Integración Uber — descartada

---

## 📱 FASES ANDROID — Resumen

> Ver `ANDROID_TODO.md` para desglose completo de cada phase.

| Phase | Nombre | Estado |
|---|---|---|
| A1 | Foundation | [ ] Pendiente |
| A2 | Auth Flow | [ ] Pendiente |
| A3 | Trip Management | [x] Completado 2026-05-05 |
| A4 | Quick Capture | [x] Completado 2026-05-05 |
| A5 | Camera + OCR | [x] Completado 2026-05-06 |
| A6 | Vista por Días + Detalle | [ ] Pendiente |
| A7 | Summary + Export | [ ] Pendiente |
| A8 | Polish + Future Evolution | [ ] Pendiente |

---

## 🐛 Bugs conocidos

- `/register` (web) no solicita confirmación de contraseña — campo `confirm_password` ausente `[Web]`
- `/register` (web) no envía `invite_code` — pendiente hasta implementar invite code en backend `[Web]` `[BE]`
- ~~Android: Retrofit singleton inicializado con localhost antes de leer ConfigStore~~ **RESUELTO (2026-05-06)** — `DynamicUrlInterceptor` + `@Named("raw")` OkHttpClient `[And]`
- Android: expenses OCR quedan huérfanos — QuickCapture crea expense nuevo en lugar de actualizar el draft `is_draft=True` del OCR. Resolver en A6. `[And]`

---

## 📌 Notas para agentes

1. Orden de lectura: `CLAUDE.md` → `MEMORY.md` → `BEST_PRACTICES.md` → este archivo.
2. Para Android: leer además `ANDROID_ARCHITECTURE.md` → `ANDROID_BEST_PRACTICES.md` → `ANDROID_TODO.md`.
3. Al completar: marcar `[x]`, actualizar `MEMORY.md`, `CLAUDE.md`, `BEST_PRACTICES.md`.
4. Al encontrar bug: añadir a "Bugs conocidos".
5. Al terminar: commit + push a GitHub → LXC: git pull + docker compose up --build.
6. Nunca avanzar una fase sin que sus bloqueantes `[!]` estén completos.
7. OCR: siempre Haiku 4.5. Flujo A nunca dispara OCR.
8. Storage: siempre Paperless-ngx del NAS.
9. BD: siempre postgres-ledger del NAS (192.168.1.154:5433).
10. `billable` DEFAULT True. `primary_currency` obligatorio al crear viaje.
11. Frontend web: llamadas al backend siempre por /api/proxy/*, nunca directamente desde el navegador.
12. Currency service: usar open.er-api.com (gratuito, sin key). No usar exchangerate.host.
13. Rama git: siempre main. Nunca master.
14. Android: el cliente **siempre genera UUIDs** antes de persistir en Room.
15. Android: export CSV/ZIP solo online — no generar en cliente Android.
16. Android: OCR solo vía backend — no BYOK en MVP.
17. Android: distribución via APK firmado (no Google Play en MVP). Acceso protegido por invite_code.
