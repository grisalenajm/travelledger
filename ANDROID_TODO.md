# ANDROID_TODO.md — Ledger Android

> Lista maestra de tareas para agentes Claude Code trabajando en la app Android.
> **Leer `ANDROID_ARCHITECTURE.md` antes de empezar cualquier tarea.**
> Al completar una tarea: marcar `[x]` aquí **y** actualizar `MEMORY.md`.

---

## 📋 Leyenda

```
[ ] — pendiente
[x] — completado
[~] — en progreso
[!] — bloqueante
[✗] — descartado permanentemente
```

---

## 🏗️ PHASE A1 — Foundation

> Setup técnico completo. Sin pantallas funcionales todavía, pero toda la infraestructura lista.

### Gradle y proyecto

- [x] Crear proyecto Android en `/android/` con Kotlin + Compose template
- [x] Configurar `build.gradle.kts` (app) con todas las dependencias de ANDROID_ARCHITECTURE.md
- [ ] Configurar `gradle/libs.versions.toml` (version catalog) — pendiente, actualmente inline versions
- [x] Añadir `kotlin-serialization` plugin
- [x] Añadir `hilt` plugin + `kapt` plugin
- [x] Configurar `compileOptions` Java 17 + `kotlinOptions` jvmTarget 17
- [x] Añadir `buildFeatures { compose = true; buildConfig = true }`
- [ ] Configurar ProGuard rules para Retrofit, Room, Hilt, Kotlin Serialization

### Tema y Design System

- [ ] Descargar fuentes Manrope (Regular, Bold, ExtraBold) y Public Sans (Regular, Medium, Bold) → `res/font/`
- [x] `presentation/theme/Color.kt` — tokens Material 3 paleta azul/índigo
- [x] `presentation/theme/Type.kt` — Typography sistema
- [x] `presentation/theme/Theme.kt` — LedgerTheme colores estáticos
- [ ] `presentation/theme/Shape.kt` — LedgerShapes (pendiente en A3)

### Internacionalización

- [x] `res/values/strings.xml` — inglés (default)
- [x] `res/values-es/strings.xml` — español

### Hilt — DI

- [x] `App.kt` — `@HiltAndroidApp`
- [x] `di/AppModule.kt` — dos OkHttpClient (@Named unauth/auth), dos Retrofit, AuthApi, AuthInterceptor
- [ ] `di/DatabaseModule.kt` — pendiente en A3
- [x] `di/DataStoreModule.kt` — provee `TokenStore`, `ConfigStore`
- [x] `di/RepositoryModule.kt` — @Binds AuthRepository
- [ ] `di/WorkerModule.kt` — Hilt Worker factory para `SyncWorker` (pendiente A4)

### Room — Base de datos local

- [ ] `data/local/room/entity/TripEntity.kt` — pendiente A3
- [ ] `data/local/room/entity/ExpenseEntity.kt` — pendiente A4
- [ ] `data/local/room/entity/PendingOperationEntity.kt` — pendiente A4
- [ ] `data/local/room/dao/TripDao.kt` — pendiente A3
- [ ] `data/local/room/dao/ExpenseDao.kt` — pendiente A4
- [ ] `data/local/room/dao/PendingOperationDao.kt` — pendiente A4
- [ ] `data/local/room/AppDatabase.kt` — pendiente A3

### DataStore y ConfigStore

- [x] `data/local/datastore/TokenStore.kt` — EncryptedSharedPreferences: access_token, refresh_token, token_expiry
- [x] `data/local/datastore/ConfigStore.kt` — EncryptedSharedPreferences: server_url, invite_code, last_email

### Retrofit — Red

- [x] `data/remote/api/AuthApi.kt` — login, register, refresh, logout, validate-invite
- [ ] `data/remote/api/TripApi.kt` — pendiente A3
- [ ] `data/remote/api/ExpenseApi.kt` — pendiente A4
- [ ] `data/remote/api/SyncApi.kt` — pendiente A5
- [x] `data/remote/interceptor/AuthInterceptor.kt` — attach Bearer + refresh automático en 401 + AuthEventBus
- [x] DTOs: `AuthDto.kt` (LoginRequest, RegisterRequest, TokenResponse, UserDto, etc.)
- [x] Retrofit con URL dinámica — se lee de ConfigStore al crear el singleton; dos instancias (unauth/auth)

### Network Monitor

- [ ] `util/NetworkMonitor.kt` — pendiente A3

### Navegación base

- [x] `presentation/navigation/Screen.kt` — sealed class (Splash, Config, Login, Register, Trips placeholder)
- [x] `presentation/navigation/AppNavGraph.kt` — grafo con auth flow completo
- [x] `presentation/MainActivity.kt` — Single Activity + `@AndroidEntryPoint` + AuthEventBus observer

### SplashScreen y ConfigScreen

- [x] `core-splashscreen` configurado en `AndroidManifest.xml`
- [x] `presentation/screen/splash/SplashViewModel.kt` — lógica completa de enrutamiento
- [x] `presentation/screen/splash/SplashScreen.kt`
- [x] `presentation/screen/config/ConfigViewModel.kt` — validar URL (OkHttp directo) + validate-invite (OkHttp directo)
- [x] `presentation/screen/config/ConfigScreen.kt`

### AndroidManifest

- [x] Permisos: INTERNET, ACCESS_NETWORK_STATE, CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE, POST_NOTIFICATIONS
- [x] FileProvider configurado
- [x] `res/xml/file_paths.xml`
- [ ] `network_security_config.xml` — cleartext solo para localhost/debug (pendiente)

### Utilidades

- [x] `util/UuidGenerator.kt` — `UUID.randomUUID().toString()`
- [ ] `util/DateFormatter.kt` — pendiente A3
- [ ] `util/CurrencyFormatter.kt` — pendiente A3

---

## 🔐 PHASE A2 — Auth Flow ✅ COMPLETADO 2026-05-05

> Login, register, sesión persistente, auto-login, logout.

### Domain

- [ ] `domain/model/User.kt` — pendiente (no requerido aún)
- [x] `domain/usecase/auth/LoginUseCase.kt`
- [x] `domain/usecase/auth/RegisterUseCase.kt`
- [x] `domain/usecase/auth/LogoutUseCase.kt`
- [ ] `domain/usecase/auth/RefreshTokenUseCase.kt` — manejado internamente en SplashViewModel

### Data

- [x] `data/repository/AuthRepository.kt` — interfaz: login, register, refresh, logout, clearTokens
- [x] `data/repository/AuthRepositoryImpl.kt` — implementación
- [x] `core/AuthEventBus.kt` — SharedFlow<AuthEvent> para SessionExpired

### Presentation

- [x] `presentation/screen/auth/login/LoginViewModel.kt` — UiState sealed class, lastEmail pre-fill
- [x] `presentation/screen/auth/login/LoginScreen.kt` — email + password toggle + botón + error
- [x] `presentation/screen/auth/register/RegisterViewModel.kt` — validación confirm_password client-side
- [x] `presentation/screen/auth/register/RegisterScreen.kt` — nombre + email + currency dropdown + password + confirm

### SplashViewModel — lógica completa

- [x] Check ConfigStore → si no hay URL → ConfigScreen
- [x] Check TokenStore → si no hay tokens → LoginScreen
- [x] Si tokens → comparar timestamp → si expirado → refresh → si OK → TripsScreen; si falla → LoginScreen

### Logout (parcial)

- [ ] `SettingsViewModel.kt` — pendiente A3/A8 (Settings screen completo)
- [ ] Diálogo de confirmación si hay ops pendientes — pendiente A4
- [x] AuthEventBus → MainActivity navega a Login si SessionExpired + toast

### Tests

- [x] `LoginViewModelTest.kt` — 3 tests: login exitoso, error credenciales, campos vacíos
- [x] `RegisterViewModelTest.kt` — 3 tests: passwords distintos, registro exitoso, registro fallido
- [x] `FakeAuthRepository.kt` — fake determinista
- [x] `MainCoroutineRule.kt` — UnconfinedTestDispatcher
- [ ] `AuthRepository_Test.kt` — pendiente (requiere mocking de API)

---

## ✈️ PHASE A3 — Trip Management ✅ COMPLETADO 2026-05-05

> Lista de viajes, crear viaje, active trip resolver. Offline-first.

### Domain

- [x] `domain/model/Trip.kt` — id, name, destination, startDate (LocalDate), endDate (LocalDate), primaryCurrency, budget, budgetCurrency, status (TripStatus enum)
- [x] `domain/usecase/trip/GetTripsUseCase.kt` — Flow desde Room
- [x] `domain/usecase/trip/GetActiveTripUseCase.kt` — trip cuyo rango incluye today (maxByOrNull startDate)
- [x] `domain/usecase/trip/CreateTripUseCase.kt` — UUID en cliente + Room + encola op
- [x] `domain/usecase/trip/DeleteTripUseCase.kt`

### Data

- [x] `data/local/room/entity/TripEntity.kt` + `PendingOperationEntity.kt`
- [x] `data/local/room/dao/TripDao.kt` + `PendingOperationDao.kt`
- [x] `data/local/room/AppDatabase.kt` — version 1, fallbackToDestructiveMigration
- [x] `data/remote/api/TripApi.kt` — getTrips, createTrip, updateTrip, deleteTrip, getSummary
- [x] `data/remote/api/dto/TripDto.kt` — TripDto, TripCreateDto, TripSummaryDto
- [x] `data/repository/TripRepository.kt` — interfaz offline-first con observePendingOpsCount()
- [x] `data/repository/TripRepositoryImpl.kt` — Room-first, PendingOperation, best-effort sync
- [x] `TripEntity ↔ Trip` + `TripDto ↔ TripEntity` mappers en `TripMappers.kt`
- [x] `di/DatabaseModule.kt` — AppDatabase, TripDao, PendingOperationDao providers

### Presentation

- [x] `presentation/screen/trips/list/TripsViewModel.kt` — combine(trips, pendingCount) → TripsUiState, isRefreshing
- [x] `presentation/screen/trips/list/TripsScreen.kt` — Variante C: hero card (activo) / LazyRow (varios) / CTA (ninguno), M3 PullToRefresh, pending badge
- [x] `presentation/screen/trips/create/CreateTripViewModel.kt` — form state, UUID client-side, isFormValid stateIn
- [x] `presentation/screen/trips/create/CreateTripScreen.kt` — DateRangePicker M3, ExposedDropdownMenu monedas, budget, status chips
- [x] `presentation/navigation/Screen.kt` — añadido CreateTrip
- [x] `presentation/navigation/AppNavGraph.kt` — TripsScreen y CreateTripScreen reales

### Componentes

- [x] `component/TripCard.kt` — StatusChip (active=verde/draft=gris/closed=negro), BudgetProgressBar inline si activo
- [x] `component/BudgetProgressBar.kt` — LinearProgressIndicator M3, color error si ≥100%
- [ ] `component/SyncStatusIndicator.kt` — integrado inline en TopBar de TripsScreen (badge en Cloud icon)

### Tests

- [x] `TripsViewModelTest.kt` — 3 tests: sin activos CTA vacío, con activo hero card, pull-to-refresh llama sync
- [x] `CreateTripViewModelTest.kt` — 3 tests: campos vacíos botón off, UUID client-side, create exitoso navega
- [x] `FakeTripRepository.kt` — fake determinista con setTrips, syncFromServerCalled
- [ ] `TripRepository_Test.kt` — pendiente (requiere mocking de API)

---

## 💶 PHASE A4 — Quick Capture ✅ COMPLETADO 2026-05-05

> La pantalla más importante. Escribir gastos offline-first con conversión live.

### Domain

- [x] `domain/model/Expense.kt` — id, tripId, amount, currency, amountBase, rateDate, category (ExpenseCategory enum), description, date, billable, paperlessDocId
- [x] `domain/model/ExpenseForm.kt` — datos del formulario antes de convertir a Expense
- [x] `domain/usecase/expense/CreateExpenseUseCase.kt` — UUID cliente + CurrencyRepository (fallback 1:1) + Room + encola op
- [x] `domain/usecase/expense/GetExpensesByDayUseCase.kt` — Flow por tripId y fecha
- [x] `domain/usecase/expense/DeleteExpenseUseCase.kt`

### Data

- [x] `data/repository/ExpenseRepository.kt` — write-through offline-first
- [x] `data/repository/ExpenseRepositoryImpl.kt` — Room-first, PendingOperation, SyncManager
- [x] `data/repository/CurrencyRepository.kt` — caché en memoria, from==to retorna 1.0
- [x] `data/repository/CurrencyRepositoryImpl.kt`
- [x] `data/local/room/entity/ExpenseEntity.kt` + `ExpenseMappers.kt`
- [x] `data/remote/api/ExpenseApi.kt` — getExpenses, createExpense, updateExpense, deleteExpense
- [x] `data/remote/api/CurrencyApi.kt` — GET /api/currencies/convert
- [x] `data/remote/api/dto/ExpenseDto.kt` + `ExpenseCreateDto.kt`
- [x] `data/remote/api/dto/CurrencyDto.kt` — ConvertResponseDto
- [x] `AppDatabase` — versión 2, añadida ExpenseEntity
- [x] `di/DatabaseModule` — provee ExpenseDao
- [x] `di/AppModule` — provee ExpenseApi, CurrencyApi
- [x] `di/RepositoryModule` — binds ExpenseRepository, CurrencyRepository

### SyncWorker — implementación completa

- [x] `sync/SyncManager.kt` — triggerOnDemand() via WorkManager
- [x] `sync/SyncWorker.kt` — procesado por dependencias (create_trip→create_expense→update→delete)
- [x] Trigger on-demand al encolar op nueva
- [x] Backoff: marca failed si 4xx o >5 intentos, pending (reintentable) si 5xx/network
- [x] Limpieza de ops `done` con más de 7 días
- [x] `App.kt` — HiltWorkerFactory + Configuration.Provider; Manifest: disable default WorkManager initializer

### Presentation

- [x] `presentation/screen/expense/capture/QuickCaptureViewModel.kt`
  - Conversión live amount → amountBase con debounce 500ms
  - Billable default true
  - UUID generado antes de guardar
  - Preparado para OcrResultDto (argumento day de navegación)
- [x] `presentation/screen/expense/capture/QuickCaptureScreen.kt`
  - Importe 64sp extrabold, auto-foco al abrir
  - ExposedDropdownMenu moneda (EUR/USD/GBP/JPY/CHF/ARS + primaryCurrency del trip)
  - FilterChip categorías en LazyRow scrollable
  - Toggle billable
  - Bottom bar: Escanear (stub) + Guardar (deshabilitado si amount=0 o sin categoría)

### TripDetailScreen — base

- [x] `presentation/screen/trips/detail/TripDetailViewModel.kt`
  - combine(trips, pendingOps, selectedDay) → flatMapLatest(expenses por día)
  - days = range startDate..endDate
- [x] `presentation/screen/trips/detail/TripDetailScreen.kt`
  - HorizontalPager sincronizado con DayChipStrip via snapshotFlow
  - BudgetProgressBar global del trip
  - Bottom bar: Escanear (stub) + Gasto → QuickCaptureDestination
  - Empty state por día

### Componentes

- [x] `component/ExpenseCard.kt` — emoji categoría + descripción + importe + conversión base
- [x] `component/DayChipStrip.kt` — FilterChip con auto-scroll al chip activo

### Navegación

- [x] `Screen.kt` — añadidos TripDetailDestination + QuickCaptureDestination
- [x] `AppNavGraph.kt` — rutas con argumentos + transiciones slide horizontal/vertical

### Tests

- [x] `QuickCaptureViewModelTest.kt` — amount=0, category null, guardar exitoso, UUID cliente, billable=true
- [x] `CreateExpenseUseCaseTest.kt` — from==to, currency API falla, UUID no nulo, amountBase correcto
- [x] `FakeExpenseRepository.kt` + `FakeCurrencyRepository.kt`

---

## 📸 PHASE A5 — Camera + OCR

> CameraX + flujo OCR completo estilo Concur.

### Permisos en runtime

- [ ] `util/PermissionHandler.kt` — wrapper para solicitar CAMERA y READ_MEDIA_IMAGES
- [ ] Rationale dialog reutilizable
- [ ] Fallback a Ajustes del sistema si denegado dos veces

### CameraScreen

- [ ] `presentation/screen/expense/camera/CameraViewModel.kt`
- [ ] `presentation/screen/expense/camera/CameraScreen.kt`
  - CameraX PreviewView
  - Viewfinder dashed + scanning line animada (Canvas)
  - Botón linterna (toggle CameraX flash)
  - Botón galería (PickVisualMedia — imágenes + PDFs)
  - Botón disparador
  - Preview post-captura: "¿Procesar?" [Reintentar] [Procesar]

### OcrProcessingScreen

- [ ] `presentation/screen/expense/processing/OcrProcessingViewModel.kt`
  - Upload imagen al backend: POST /api/receipts/upload
  - Guardar imagen en `pending_uploads/` antes de subir
  - Recibir OcrResultDto
  - Manejar errores de red: continuar manual o reintentar
- [ ] `presentation/screen/expense/processing/OcrProcessingScreen.kt`
  - Thumbnail del ticket
  - Scanning line animada sobre thumbnail
  - Checks: imagen guardada → subiendo → analizando
  - Botón Cancelar
  - Pantalla de error con opciones

### Integración con QuickCaptureScreen

- [ ] `QuickCaptureViewModel` acepta `OcrResultDto?` como argumento de navegación
- [ ] Si viene de OCR: pre-rellenar campos según mapeo de ANDROID_ARCHITECTURE.md
- [ ] Lógica de fecha OCR: si dentro del trip → usar; si fuera → fallback día contexto
- [ ] Al guardar, calcular día correcto y saltar la vista de TripDetail a ese día

### Compresión de imagen

- [ ] Comprimir imagen antes de subir: max 1280px lado mayor, JPEG quality 85
- [ ] `util/ImageCompressor.kt`

### Tests

- [ ] `CameraViewModel_Test.kt`
- [ ] `OcrProcessingViewModel_Test.kt` — mock API, casos con red y sin red

---

## 📊 PHASE A6 — Vista por Días + Detalle de Gasto

> TripDetailScreen completa + ExpenseDetailScreen + filtros.

### ExpenseDetailScreen

- [ ] `presentation/screen/expense/detail/ExpenseDetailViewModel.kt` — get, update, delete
- [ ] `presentation/screen/expense/detail/ExpenseDetailScreen.kt`
  - Ver todos los campos del gasto
  - Editar inline
  - Thumbnail de la factura (si tiene paperless_doc_id)
  - Botón "Ver factura" → open URL del documento en Paperless
  - Eliminar con confirmación

### TripDetailScreen — completar

- [ ] Filtro por categoría (chips en toolbar del día)
- [ ] Estado vacío "Sin gastos este día" con CTA
- [ ] Tap en ExpenseCard → ExpenseDetailScreen
- [ ] Long press en ExpenseCard → quick delete con undo snackbar

### Componentes adicionales

- [ ] `component/AppBottomNav.kt` — Dashboard (TripsScreen) | Trips | Scan | Settings
- [ ] `component/AppTopBar.kt` — back, título, acciones variables

### Tests

- [ ] `ExpenseDetailViewModel_Test.kt` — update, delete, mappers

---

## 📈 PHASE A7 — Summary + Export

> SummaryScreen con gráfico + export CSV/ZIP vía backend.

### SummaryScreen

- [ ] `presentation/screen/summary/SummaryViewModel.kt`
  - Totales por categoría (calculados desde Room)
  - Breakdown por moneda
  - Totales billable vs personal
  - Detectar si hay red para habilitar/deshabilitar export
- [ ] `presentation/screen/summary/SummaryScreen.kt`
  - Donut chart (Compose Canvas — no librería externa)
  - Breakdown por categoría con porcentajes
  - Breakdown por moneda
  - Totales billable / personal
  - Botones Exportar CSV y Exportar ZIP (deshabilitados si offline)

### Export

- [ ] `data/repository/ExportRepository.kt` — download CSV/ZIP del backend
- [ ] `util/FileShareUtil.kt` — guardar en `cacheDir/exports/` + Intent.ACTION_SEND vía FileProvider
- [ ] `domain/usecase/export/ExportCsvUseCase.kt`
- [ ] `domain/usecase/export/ExportZipUseCase.kt`

### Tests

- [ ] `SummaryViewModel_Test.kt` — cálculos de totales desde Room mock

---

## ✨ PHASE A8 — Polish + Future Evolution

> Características adicionales, no bloqueantes para MVP.

- [ ] FCM Push Notifications — alertas de presupuesto (80% y 100%)
- [ ] Biometría (huella / face unlock) para abrir la app
- [ ] Dark mode (Dynamic Color Material 3)
- [ ] Animaciones de transición entre pantallas
- [ ] TripLegs (tramos de transporte) — CRUD
- [ ] Loyalty Cards — CRUD
- [ ] BYOK OCR — elegir motor (Anthropic, OpenAI, DeepSeek) con API key del usuario
- [ ] Offline OCR fallback (ML Kit on-device)
- [ ] Widget Glance — total del día en pantalla principal
- [ ] Configuración de Paperless en Settings
- [ ] Enlace cuenta Telegram en Settings

---

## 🔧 Backlog de cambios en Backend y Web requeridos por Android

> Estos cambios deben hacerse en el backend antes de que la app Android pueda funcionar correctamente.
> Añadir a `TODO.md` global con etiqueta `[BE]` o `[Web]`.

### Backend `[BE]`

- [ ] [!] Añadir `REGISTRATION_INVITE_CODE` a `.env` y `config.py`
- [ ] [!] Crear endpoint `POST /api/auth/validate-invite` — validar code antes de register
- [ ] [!] Modificar `UserCreate` schema: añadir `invite_code: str` obligatorio
- [ ] [!] Modificar `POST /api/auth/register`: validar `invite_code`
- [ ] [!] Modificar `TripCreate` schema: añadir `id: UUID | None = None`
- [ ] [!] Modificar `trip_service.create()`: respetar `id` si viene, generar si no
- [ ] [!] Modificar `ExpenseCreate` schema: añadir `id: UUID | None = None`
- [ ] [!] Modificar `expense_service.create()`: respetar `id` si viene, generar si no
- [ ] [!] Idempotencia: `POST` con UUID ya existente del mismo usuario → `200` con recurso existente
- [ ] Implementar `GET /api/sync/pull?since={timestamp}`
- [ ] Implementar `POST /api/sync/push` (idempotente por `operation_id`)

### Web `[Web]`

- [ ] Añadir campo `invite_code` al formulario `/register`
- [ ] Pasar `invite_code` en body de `POST /api/auth/register`

### Infra `[Infra]`

- [ ] Rate limit en nginx-proxy-manager: `/api/auth/register` → 3 intentos/hora por IP

---

## 📌 Notas para agentes

1. Leer `ANDROID_ARCHITECTURE.md` completo antes de empezar.
2. El cliente Android **siempre genera UUIDs** antes de persistir en Room.
3. **Optimistic UI siempre** — Room primero, red después.
4. Los permisos se piden **en contexto**, nunca al arrancar la app.
5. La URL del backend viene de `ConfigStore`, nunca hardcodeada.
6. Export CSV/ZIP solo online — no generar en cliente Android.
7. OCR solo vía backend — no BYOK en MVP.
8. Al completar: marcar `[x]`, actualizar `MEMORY.md`.
9. Al encontrar bug: añadir a "Bugs conocidos" en `MEMORY.md`.
10. Al terminar: commit con mensaje descriptivo + push a GitHub.
