# MEMORY.md — Estado del Proyecto

> **Actualizar este archivo después de cada sesión de trabajo.**
> Los agentes deben leerlo al inicio y actualizarlo al finalizar.

---

## 📅 Última actualización
- **Fecha:** 2026-05-06
- **Agente:** Claude Sonnet 4.6
- **Sesión:** Android A5 Camera + OCR + fix Retrofit DynamicUrlInterceptor + APK debug emulador

---

## ✅ Completado

- [x] Arquitectura multiplataforma definida (Android + Web + Bot + Backend)
- [x] CLAUDE.md — modelos de datos completos, flujos A/B, export bundle, TripLeg, LoyaltyCard
- [x] MEMORY.md — actualizado
- [x] BEST_PRACTICES.md — creado
- [x] DESIGN_SYSTEM.md — creado con tokens completos (stitch de referencia)
- [x] TODO.md — reorganizado con fases 0–9 + fases Android A1-A8
- [x] **ANDROID_ARCHITECTURE.md** — creado (2026-05-04): todas las decisiones de diseño Android
- [x] **ANDROID_TODO.md** — creado (2026-05-04): tareas atómicas phases A1-A8
- [x] **ANDROID_BEST_PRACTICES.md** — creado (2026-05-04): convenciones Kotlin/Compose
- [x] docker-compose.yml, docker-compose.dev.yml, .env.example, nas-postgres-ledger.yml
- [x] **FASE 0 skeleton** — backend, frontend, bot listos y desplegados
- [x] **FASE 1 Backend Auth** — desplegado y smoke-tested en producción
- [x] **FASE 2 Backend** — trips/expenses/legs/loyalty-cards/currency; 27/27 tests
- [x] **FASE 2 Web** — desplegado 2026-04-25/26 (todas las pantallas)
- [x] **Settings API** — 2026-04-27 (modelo, migration 0004, service, router, paperless_service per-user)
- [x] **FASE 1 Web Auth** — desplegado y verificado
- [x] **Backend Android bloqueantes (2026-05-04)** — invite_code (validate-invite + register), UUID opcional en TripCreate/ExpenseCreate, idempotencia en trip_service/expense_service
- [x] **Android A1 Foundation (2026-05-05)** — proyecto Gradle completo, Hilt, Compose, Room, Retrofit (dos clientes OkHttp: unauth + auth), Theme M3, Navigation base, App.kt, AndroidManifest
- [x] **Android A2 Auth Flow (2026-05-05)** — TokenStore, ConfigStore (EncryptedSharedPreferences), AuthDto, AuthApi, AuthInterceptor (refresh automático + AuthEventBus), AuthRepository, LoginUseCase, RegisterUseCase, LogoutUseCase, SplashViewModel, ConfigScreen+VM, LoginScreen+VM, RegisterScreen+VM, AppNavGraph, MainActivity, tests (LoginViewModelTest 3 tests, RegisterViewModelTest 3 tests, FakeAuthRepository)
- [x] **Web /register fix (2026-05-05)** — invite_code enviado en POST (NEXT_PUBLIC_INVITE_CODE), añadido a .env.example y docker-compose.yml; frontend redesplegado en LXC
- [x] **Android A3 Trip Management (2026-05-05)** — TripEntity+PendingOperationEntity, TripDao+PendingOperationDao, AppDatabase (v1), TripDto/TripCreateDto/TripSummaryDto, TripApi, TripMappers, Trip domain model, TripRepository offline-first (Room-first + PendingOperation + best-effort sync), 4 UseCases (GetTrips/GetActiveTrip/CreateTrip/DeleteTrip), TripsViewModel (combine+stateIn), CreateTripViewModel (UUID client-side), TripsScreen (hero card + pull-to-refresh M3 + pending badge), CreateTripScreen (DateRangePicker + currency dropdown), TripCard + BudgetProgressBar, DatabaseModule, 3 tests TripsViewModel + 3 tests CreateTripViewModel + FakeTripRepository
- [x] **Android A4 Quick Capture (2026-05-05)** — ExpenseEntity+ExpenseDao (AppDatabase v2), ExpenseDto/CurrencyDto, ExpenseApi/CurrencyApi, Expense domain model (ExpenseCategory enum con emoji()), ExpenseForm, ExpenseMappers (Entity↔Domain↔Dto), ExpenseRepository (write-through offline-first), CurrencyRepository (caché en memoria, from==to→1.0), CreateExpenseUseCase (rate fallback 1:1), GetExpensesByDayUseCase, DeleteExpenseUseCase, SyncManager+SyncWorker (orden dependencias: create_trip→create_expense→update→delete, limpieza 7d), App.kt HiltWorkerFactory+Configuration.Provider, Manifest WorkManager initializer disabled, DI actualizado, QuickCaptureViewModel (debounce 500ms conversión live, billable=true default), QuickCaptureScreen (64sp amount field, CategoryChips LazyRow, currency dropdown, bottom bar), TripDetailViewModel (flatMapLatest expenses×día), TripDetailScreen (HorizontalPager+DayChipStrip sincronizados via snapshotFlow), ExpenseCard+DayChipStrip components, AppNavGraph+Screen actualizados (TripDetailDestination+QuickCaptureDestination), 5 tests QuickCaptureViewModel + 5 tests CreateExpenseUseCase + FakeExpenseRepository + FakeCurrencyRepository
- [x] **Android A5 Camera + OCR (2026-05-06)** — CameraManager (CameraX singleton), ReceiptApi (multipart upload), OcrResult domain model + OcrResultParcel (JSON navigation), CameraScreen (viewfinder, scanning line animada, galería photo picker, permisos 2-strike), OcrProcessingScreen (steps progresivos: upload→OCR→confirm, offline/error handling con reintentar/manual). Adaptación: backend devuelve ExpenseRead directamente en `/api/receipts/upload` (no OcrResultDto separado). Pendiente A6: expenses OCR quedan huérfanos — QuickCapture crea expense nuevo en lugar de actualizar el draft OCR.
- [x] **APK debug compilado y probado en emulador (2026-05-06)** — `android:usesCleartextTraffic="true"` añadido a AndroidManifest.xml para HTTP en desarrollo. Fix Retrofit: DynamicUrlInterceptor reescribe host/port en cada petición leyendo ConfigStore, elimina fallback localhost. Build: Gradle 8.2 (`C:\gradle\gradle-8.2\bin\gradle.bat assembleDebug`), JDK 17, Android SDK `C:\Users\grisa\AppData\Local\Android\Sdk`. Install: `adb install app\build\outputs\apk\debug\app-debug.apk`. Emulador: Pixel 10 API 36.1, AVD en D:\android\avd\ (C: sin espacio).

---

## 🎨 Sesión de diseño Android (2026-05-04)

### Decisiones tomadas — resumen ejecutivo

#### Producto y distribución
| Decisión | Resultado |
|---|---|
| Modelo de distribución | **Camino 1** — App privada, APK firmado, no Google Play en MVP |
| Apertura futura | Arquitectura preparada para multi-tenant (cada usuario su backend) sin cambios de código |
| Seguridad de registro | **Invite code obligatorio** en `POST /api/auth/register` |
| OCR | **Vía backend** (Anthropic key del servidor). BYOK en future evolution |
| Export CSV/ZIP | **Solo online** vía backend. No se genera en cliente Android |

#### UX — Pantallas y flujos
| Pantalla | Decisión |
|---|---|
| Lista de viajes | **Variante C** — viaje activo como card hero + scroll de otros viajes |
| Vista del trip | **Por días**, HorizontalPager + chip strip + progress bar global |
| Quick Capture | **Pantalla completa** (no bottom sheet), importe XXL, auto-foco, categoría chips |
| OCR — punto de entrada | Botón "📸 Escanear" en vista por días + botón en Quick Capture |
| OCR — post-captura | **Preview foto + confirmación** antes de procesar ("¿Procesar esta foto?") |
| OCR — procesado | **Pantalla dedicada estilo Concur**: thumbnail + scanning line + checks progresivos |
| OCR — resultado | **Quick Capture pre-rellenada** (sin pantalla intermedia de Review) |
| OCR — fecha detectada | Si dentro del trip → usar esa fecha; si fuera → fallback al día del contexto |
| OCR — al guardar con fecha ≠ día visible | **Vista salta al día del gasto** al guardar |
| OCR — moneda distinta al trip | **Respetar OCR** (no advertencia, el esquema soporta dos monedas) |
| OCR — error/sin red | Pantalla error con [Continuar manualmente] y [Reintentar]. Foto encolada |
| Captura galería | **Sí** — photo picker (imágenes + PDFs) |
| Linterna | **Sí** — toggle en CameraScreen |

#### Técnicas
| Decisión | Resultado |
|---|---|
| UUIDs | **Generados en cliente Android** antes de persistir en Room |
| Offline — crear viaje | **Sí** — offline-first con PendingOperation |
| Offline — crear gasto | **Sí** — write-through con PendingOperation |
| Offline — export CSV/ZIP | **No** — solo online via backend |
| PendingOperation retención | 7 días en estado `done`, luego se borran |
| Reintentos sync | Máx 5 intentos, backoff exponencial (1min → 5min → 15min → 1h → 6h) |
| Trigger SyncWorker | Periódica 30min + on-demand al encolar + pull-to-refresh manual |
| Orden de sync | Por dependencias (create_trip antes que create_expense de ese trip) |
| Conflictos | Last write wins, sin diálogos |
| Optimistic UI | **Siempre** — Room primero, red después |
| Feedback sync al usuario | Indicador ☁️N en TopBar + banner si hay fallos + pantalla detalle en Settings |

#### Auth y onboarding
| Decisión | Resultado |
|---|---|
| Primer arranque | **URL configurable en runtime** (no embebida). URL + invite code en ConfigScreen |
| Endpoint validate-invite | Vive en el backend del usuario (no es un servicio central) |
| Recordar sesión | **Opt-out por defecto** — sesión se mantiene hasta logout explícito |
| Olvidé contraseña | **Future evolution** — no en MVP |
| Comportamiento 401 | Refresh → si falla: logout suave, mantener Room, email pre-rellenado |
| Logout | Con confirmación. Si hay PendingOps → preguntar si sincronizar antes |
| Auto-login | **Sí** vía SplashScreen |
| Biometría | **Future evolution** |

#### Internacionalización
| Decisión | Resultado |
|---|---|
| Idiomas | **Español + inglés** desde MVP (`values/` EN, `values-es/` ES) |
| Formato fechas/números | Respetar **locale del dispositivo** |
| Excepción CSV | Formato backend (punto decimal, ISO 8601) |
| Símbolos moneda | Nativo cuando único; ISO cuando ambiguo (USD$, CAD$) |

#### Permisos y sistema
| Decisión | Resultado |
|---|---|
| FCM Push Notifications | **Future evolution** (Phase A8) |
| Estrategia permisos | **Contextual** — pedir cuando el usuario entiende por qué |
| Cámara | Pedir al pulsar "📸 Escanear" por primera vez |
| Galería | Pedir al pulsar "🖼️ Galería" por primera vez |
| Detección de red | NetworkMonitor con Flow + ConnectivityManager |
| FileProvider | Configurado para export share sheet |

---

## 🔄 En Progreso

- **FASE Android A6** — Vista por Días mejorada + Detalle de gasto (siguiente)

---

## ⏳ Pendiente — resumen por fase

- **FASE 0:** ✅ Completado (pendiente menor: README NAS, seed SQL)
- **FASE 1 Backend:** ✅ Completado — todos los bloqueantes Android implementados
- **FASE 1 Web:** ✅ Completado — fix /register invite_code desplegado (2026-05-05); NEXT_PUBLIC_INVITE_CODE pendiente de añadir al .env del LXC
- **FASE 1 Android:** ✅ A1 + A2 + A3 + A4 completados (2026-05-05)
- **FASE 2:** ✅ Completado (backend + web)
- **FASE 2 Android:** ✅ A3 + A4 completados (2026-05-05)
- **FASE 3:** OCR backend + web scan screens + Android Phase A5
- **FASE 4:** Paperless cascade delete + Android "Ver factura"
- **FASE 5:** Sync backend (push/pull endpoints) + Android SyncWorker pull completo
- **FASE 6:** Export bundle + Android Phase A7
- **FASE 7:** FCM push + polish + Android Phase A8
- **FASE 8:** Bot Telegram completo
- **FASE 9 (backlog):** OCR de vuelos para TripLeg, BYOK OCR Android, biometría

---

## 🔧 Fixes Aplicados

### Fix 1 — Sync de código al LXC antes de build (2026-04-25)
Antes de cualquier build, sincronizar via `tar + scp` o `git pull`. Los errores de ownership Windows→Linux son inofensivos.

### Fix 2 — Proxy route faltante (2026-04-25)
`app/api/proxy/[...path]/route.ts` era necesario. Sin él: 307 redirect → TanStack Query recibía errores silenciosos.

### Fix 3 — lib/api.ts con URL relativa (2026-04-25)
`API_BASE = ""` (vacío). Las llamadas son relativas (`/api/proxy/trips`), van al servidor Next.js, el proxy añade el token.

### Fix 4 — Proveedor de tipos de cambio (2026-04-26)
`exchangerate.host` dejó de funcionar sin key. Migrado a `open.er-api.com` (plan gratuito, solo tipos actuales).

---

## 🐛 Bugs Conocidos

- `/register` (web) requiere añadir `NEXT_PUBLIC_INVITE_CODE` al .env del LXC para que funcione en prod `[Infra]`
- **Android: Retrofit fallback a localhost** — el singleton se creaba con `runBlocking { configStore.getServerUrl() } ?: "http://localhost:8000/"` en AppModule, por lo que si ConfigStore no tenía URL en el momento del boot de Hilt, quedaba fijado en localhost. **RESUELTO (2026-05-06):** `DynamicUrlInterceptor` reescribe `scheme/host/port` en cada petición leyendo ConfigStore al vuelo. ConfigViewModel usa `@Named("raw")` OkHttpClient (sin interceptor) para que sus llamadas de validación vayan a la URL del usuario, no a ConfigStore. `[CRÍTICO — impide login]`
- **Android: expenses OCR huérfanos en A5** — cuando OcrProcessingScreen navega a QuickCapture, éste crea un expense nuevo en lugar de actualizar el draft `is_draft=True` creado por OCR. Resolver en A6.

## ⚠️ Pendiente de Infra

- Rate limit nginx-proxy-manager: `/api/auth/register` → 3 req/hora por IP (fuera de scope backend)

---

## 🔑 Decisiones de Arquitectura y Producto

| Decisión | Detalle | Razón |
|----------|---------|-------|
| BD dedicada en NAS | `postgres-ledger` contenedor propio, puerto 5433 | Aislamiento y backup granular |
| Sin Postgres en LXC | Usar el del NAS | El LXC solo tiene 768 MB RAM |
| Paperless-ngx vía API | Único almacén de imágenes | Reutilizar infra existente |
| Haiku 4.5 para OCR | Sin Tesseract | 0 MB RAM en LXC, calidad superior |
| Haiku 4.5 para bot | Sin Ollama | Sin GPU |
| Dos monedas por gasto | `amount` + `amount_base` | Sin moneda intermedia |
| `billable` DEFAULT True | Todo gasto es corporativo por defecto | Caso de uso principal |
| Flujo A vs Flujo B | Dos endpoints distintos, intención explícita | OCR nunca dispara en Flujo A |
| Export ZIP plano | Naming `{cat}_{date}_{slug}.ext` | Compatible con Concur/SAP |
| **App Android privada** | APK firmado, invite_code, no Google Play MVP | Control total de acceso |
| **UUIDs en cliente Android** | El cliente genera antes de persistir | Offline-first, idempotencia |
| **URL backend configurable** | Sin hardcode, ConfigScreen en primer arranque | Portabilidad, apertura futura |
| **Export Android solo online** | No se genera CSV/ZIP en cliente | Simplicidad, coherencia con backend |
| **OCR Android vía backend** | No BYOK en MVP | Seguridad, coherencia |

---

## 📝 Notas de Contexto

- **NAS UGREEN:** corre Paperless-ngx, postgres-vectorchord, nginx-proxy-manager, postgres-ledger.
- **LXC Proxmox:** IP 192.168.1.125, Ubuntu 24.04, Docker. Despliega backend+frontend+bot.
- **PostgreSQL Ledger:** 192.168.1.154:5433, DB `ledger`, usuario `ledger_user`.
- **Moneda base del usuario:** configurable en Settings. Por defecto EUR. Caso principal: CHF.
- **App Android:** Trabee Pocket con OCR corporativo. Captura en el terreno. Offline-first.
- **Distribución Android:** APK firmado. Distribución privada (Firebase App Distribution o manual).
- **Invite code:** variable de entorno `REGISTRATION_INVITE_CODE` en `.env` del backend. No embebido en APK.
- **NAS UGREEN — reinicio:** después de reiniciar el NAS, el backend queda en estado unhealthy hasta que `postgres-ledger` arranca completamente. Solución: esperar a que `nc -zv 192.168.1.154 5433` responda y luego `docker compose restart backend` en el LXC.
- **Emulador Android — red:** el emulador usa la red WiFi del PC. No puede acceder a `192.168.1.125` si el PC no está en la red local. Verificar conectividad con `curl http://192.168.1.125:8000/health` desde PowerShell antes de probar la app.

---

## 📚 Documentos del Proyecto

| Documento | Contenido |
|---|---|
| `CLAUDE.md` | Arquitectura general, modelos, contrato API |
| `MEMORY.md` | Este archivo — estado actual del proyecto |
| `TODO.md` | Tareas globales web/backend/bot |
| `BEST_PRACTICES.md` | Convenciones backend/web |
| `DESIGN_SYSTEM.md` | Tokens visuales, componentes, pantallas |
| `DESIGN_SYSTEM_addendum.md` | Pantallas adicionales al stitch original |
| `ANDROID_ARCHITECTURE.md` | Decisiones de diseño y arquitectura Android |
| `ANDROID_TODO.md` | Tareas atómicas phases A1-A8 |
| `ANDROID_BEST_PRACTICES.md` | Convenciones Kotlin/Compose |
