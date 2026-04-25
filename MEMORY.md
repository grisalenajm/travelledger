# MEMORY.md — Estado del Proyecto

> **Actualizar este archivo después de cada sesión de trabajo.**
> Los agentes deben leerlo al inicio y actualizarlo al finalizar.

---

## 📅 Última actualización
- **Fecha:** 2026-04-24
- **Agente:** Claude Sonnet 4.6
- **Sesión:** FASE 0 completada (deploy verificado) + FASE 1 Backend Auth implementado y desplegado

---

## ✅ Completado

- [x] Arquitectura multiplataforma definida (Android + Web + Bot + Backend)
- [x] CLAUDE.md — modelos de datos completos, flujos A/B, export bundle, TripLeg, LoyaltyCard
- [x] MEMORY.md — actualizado
- [x] BEST_PRACTICES.md — creado
- [x] DESIGN_SYSTEM.md — creado con tokens completos (stitch de referencia)
- [x] TODO.md — reorganizado con fases 0–9, tareas nuevas de producto
- [x] docker-compose.yml — 3 servicios (backend, frontend, bot), sin Postgres/MinIO propios
- [x] docker-compose.dev.yml — hot-reload
- [x] .env.example — variables correctas (NAS puerto 5433, Haiku, sin Ollama)
- [x] nas-postgres-ledger.yml — fragmento para el NAS
- [x] **FASE 0 skeleton** — todos los ficheros de código generados:
  - backend: main.py, config.py, database.py, routers/health.py, alembic/env.py, Dockerfile, requirements.txt, tests/conftest.py
  - frontend: layout.tsx, page.tsx, globals.css, api/health/route.ts, lib/api.ts, types/index.ts, Dockerfile, package.json, tailwind.config.ts
  - bot: main.py, config.py, handlers (commands/message/photo/callback), llm_service.py, ledger_client.py, session.py, trip_resolver.py, prompts/, Dockerfile, requirements.txt
  - .gitignore, secrets/.gitkeep, android/.gitkeep
- [x] Bot health server en puerto 8080 (threading.Thread + stdlib http.server), separado del webhook port 8443
- [x] `.env` generado con todos los secrets reales
- [x] **Deploy verificado en LXC 192.168.1.125** — 3 servicios healthy (backend, frontend, bot)
- [x] DB password actualizada en `/opt/ledger/.env`
- [x] **FASE 1 Backend Auth** — desplegado y smoke-tested en producción:
  - `app/models/user.py` — SQLAlchemy User (UUID PK, email unique, bcrypt hash, timestamps)
  - `app/schemas/auth.py` — UserCreate, UserLogin, UserRead, UserUpdate, Token, TokenRefresh, DeviceRegister
  - `app/core/security.py` — hash/verify bcrypt, create/decode JWT access+refresh
  - `app/core/dependencies.py` — `get_current_user` (Bearer token → User)
  - `app/routers/auth.py` — POST register/login/refresh/logout/device
  - `app/routers/users.py` — GET/PUT /api/users/me
  - `alembic/versions/0001_create_users.py` — migración aplicada ✅
  - `tests/test_jwt.py` + `tests/test_auth.py` — suite completa
  - Fix: `bcrypt>=4.0,<5.0` (incompatibilidad passlib 1.7.4 + bcrypt 5.x)
- [x] **FASE 1 Web Auth** — desplegado y verificado en http://192.168.1.125:3000/login:
  - `lib/auth.ts` — NextAuth authOptions: credentials provider → backend login → /me
  - `app/api/auth/[...nextauth]/route.ts` — handler NextAuth
  - `components/providers.tsx` — SessionProvider wrapper (client)
  - `app/(auth)/login/page.tsx` — split-screen, design tokens, react-hook-form + zod
  - `app/(auth)/register/page.tsx` — igual + campo name + currency_base
  - `hooks/use-auth-store.ts` — Zustand: user, isLoading, error, reset
  - `middleware.ts` — withAuth, protege todo excepto /login /register /api/auth
  - `lib/api.ts` — auto-JWT desde session, 401 → signOut({ callbackUrl:"/login" })
  - `types/next-auth.d.ts` — augmentación: Session.accessToken, JWT.id/accessToken/refreshToken
  - `docker-compose.yml` — frontend ports: 3000:3000 (necesario para NGINX del NAS)

---

## 🔄 En Progreso

- **FASE 1 Android** — LoginScreen, AuthRepository, AuthInterceptor, TokenStore, SplashScreen

---

## ⏳ Pendiente — resumen por fase

- **FASE 0:** ✅ Completado (pendiente menor: README NAS, Android skeleton, seed SQL)
- **FASE 1 Backend:** ✅ Completado y desplegado
- **FASE 1 Web/Android:** Auth completo (nextauth, screens kotlin)
- **FASE 2:** CRUD Trips + TripLegs + Expenses + LoyaltyCards + CurrencyService
- **FASE 3:** OCR (ocr_service.py + paperless_service.py + router upload)
- **FASE 4:** Paperless cascade delete + botones "Ver factura"
- **FASE 5:** Offline sync Android (WorkManager + endpoints push/pull con legs)
- **FASE 6:** Export bundle (CSV + ZIP imágenes de Paperless)
- **FASE 7:** FCM push notifications + polish
- **FASE 8:** Bot Telegram completo
- **FASE 9 (backlog):** OCR de confirmaciones de vuelo para TripLeg automático

---

## 🐛 Bugs Conocidos

*(ninguno)*

---

## 🔑 Decisiones de Arquitectura y Producto

| Decisión | Detalle | Razón |
|----------|---------|-------|
| BD dedicada en NAS | `postgres-ledger` contenedor propio, puerto 5433 | Aislamiento de proceso y backup granular sin tocar otros servicios del NAS |
| Sin Postgres en LXC | Usar el del NAS | El LXC solo tiene 768 MB RAM |
| Paperless-ngx vía API | Único almacén de imágenes | Reutilizar infra existente, sin MinIO |
| Haiku 4.5 para OCR | Sin Tesseract | 0 MB RAM en LXC, calidad superior, ~€0.003/ticket |
| Haiku 4.5 para bot | Sin Ollama | Sin GPU, sin modelo local, coherencia de stack |
| Dos monedas por gasto | `amount` (transaccional) + `amount_base` (currency_base usuario) | Simplicidad — no hay moneda intermedia del país |
| `User.currency_base` | Moneda de reporting corporativo | Un usuario siempre reporta en la misma moneda (ej. CHF) |
| `Trip.primary_currency` OBLIGATORIO | Moneda por defecto al crear gastos | Se puede cambiar por gasto; necesario para UX fluida |
| `Trip.budget_currency` | Moneda del presupuesto, independiente | Permite definir presupuesto en CHF aunque el viaje sea a Argentina |
| `billable` DEFAULT True | Todo gasto es corporativo por defecto | Caso de uso principal: reportar a empresa |
| TripLeg datetimes naive | Sin conversión UTC | El usuario ve la hora del billete, no UTC |
| TripLeg + loyalty_card_id | Tarjeta de viajero del tramo | Permite acreditar millas/puntos por trayecto |
| Flujo A vs Flujo B | Dos endpoints distintos, intención explícita | Si el usuario metió datos a mano, el OCR nunca se dispara |
| Export ZIP plano | Sin subcarpetas, naming `{cat}_{date}_{slug}.ext` | Compatible con Concur/SAP y herramientas de empresa |
| Uber descartado | Sin API pública gratuita para usuarios individuales | Uber for Business requiere acuerdo corporativo |
| LoyaltyCard (no bancaria) | Programas de viajero frecuente (airline, train, hotel) | Las tarjetas bancarias no se almacenan — solo medio de pago string |

---

## 📝 Notas de Contexto

- **NAS UGREEN:** corre Paperless-ngx, postgres-vectorchord (otras apps), nginx-proxy-manager. El nuevo `postgres-ledger` es un contenedor adicional dedicado solo a Ledger.
- **LXC Proxmox:** IP 192.168.1.125, Ubuntu 24.04, Docker ya instalado. Desplegará backend+frontend+bot con docker-compose.
- **PostgreSQL Ledger:** 192.168.1.154:5433, DB `ledger`, usuario `ledger_user`.
- **LXC Proxmox:** 768 MB RAM, 10 GB disco, nesting Docker habilitado. Sin GPU. Mailcow y otros CTs corren en el mismo Proxmox — recursos justos.
- **Portátil MSI Vector 16 (RTX):** apagado la mayor parte del tiempo. No se usa como servidor.
- **Moneda base del usuario:** configurable en Settings. Por defecto EUR. En el caso de uso principal: CHF (reporting corporativo a empresa suiza).
- **Moneda transaccional:** lo que marcaba el ticket — ARS en Argentina, JPY en Japón, etc.
- **`Trip.primary_currency`:** la moneda del país de destino. Obligatorio al crear el viaje. Es solo el default del formulario de gasto, no una restricción.
- **OCR Flujo A vs B:** dos rutas completamente separadas en la API. En Flujo A (`POST /api/expenses`) la imagen se sube a Paperless sin pasar por Haiku. En Flujo B (`POST /api/receipts/upload`) Haiku procesa primero, luego el usuario confirma, luego se crea el gasto.
- **Export bundle:** CSV + ZIP imágenes en un solo ZIP descargable. Pensado para adjuntar a notas de gastos de empresa. Cada fila del CSV tiene `image_file` con el nombre exacto del fichero dentro del ZIP.
- **Bot mode:** webhook en producción (nginx del NAS enruta), polling en desarrollo local.
- **Android minSdk:** 26 (Android 8.0). targetSdk: 34 (Android 14).
- **Scanner Android:** path principal = imagen al backend → Haiku. ML Kit on-device solo como fallback sin conexión; al recuperar red se re-envía al backend.
- **TripLeg datetime naive:** se guarda la hora local tal como aparece en el billete (ej. "salida 23:00 Madrid", "llegada 18:30 Tokio del día siguiente"). No hay conversión a UTC.

---

## 🎨 Design System

- [x] DESIGN_SYSTEM.md completo con tokens, componentes y 4 pantallas del stitch
- [x] Pantallas del stitch: Dashboard, Trip Detail, Scanner, Confirm Expense
- [x] Tipografía: Manrope (headline) + Public Sans (body/label)
- [x] Equivalencias Android (Compose + Material 3)

**Pantallas nuevas a implementar (sin diseño en stitch — usar tokens existentes):**
- [ ] Login / Register
- [ ] Lista de viajes `/trips`
- [ ] Nuevo viaje `/trips/new` — date range picker + selector primary_currency
- [ ] Tramos del viaje `/trips/[id]/legs` — cards con icono de modo, horarios locales, localizador
- [ ] Loyalty cards `/settings/cards` — lista con program_type badge, tier pill
- [ ] Modal export — toggle billable, date range, botones CSV y ZIP
- [ ] Reports `/reports` — gráficos + tabla en currency_base
- [ ] Settings `/settings` — currency_base, vinculación Telegram, notificaciones

---

## 🔗 Referencias

- [Paperless-ngx API](https://docs.paperless-ngx.com/api/)
- [Claude Haiku Vision](https://docs.anthropic.com/en/docs/vision)
- [Claude Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [ML Kit Text Recognition Android](https://developers.google.com/ml-kit/vision/text-recognition/android)
- [CameraX](https://developer.android.com/training/camerax)
- [Jetpack Compose](https://developer.android.com/jetpack/compose)
- [WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager)
- [python-telegram-bot](https://python-telegram-bot.org/)
- [exchangerate.host](https://exchangerate.host/)
