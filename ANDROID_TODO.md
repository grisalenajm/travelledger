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

- [ ] Crear proyecto Android en `/android/` con Kotlin + Compose template
- [ ] Configurar `build.gradle.kts` (app) con todas las dependencias de ANDROID_ARCHITECTURE.md
- [ ] Configurar `gradle/libs.versions.toml` (version catalog)
- [ ] Añadir `kotlin-serialization` plugin
- [ ] Añadir `hilt` plugin + `kapt` plugin
- [ ] Configurar `buildTypes` debug (API_BASE vacío, configurable en runtime) y release
- [ ] Configurar `compileOptions` Java 17 + `kotlinOptions` jvmTarget 17
- [ ] Añadir `buildFeatures { compose = true; buildConfig = true }`
- [ ] Configurar ProGuard rules para Retrofit, Room, Hilt, Kotlin Serialization

### Tema y Design System

- [ ] Descargar fuentes Manrope (Regular, Bold, ExtraBold) y Public Sans (Regular, Medium, Bold) → `res/font/`
- [ ] `ui/theme/Color.kt` — tokens Material 3 desde DESIGN_SYSTEM.md
- [ ] `ui/theme/Type.kt` — LedgerTypography con Manrope + Public Sans
- [ ] `ui/theme/Shape.kt` — LedgerShapes (extraSmall=2dp, small=4dp, medium=8dp, large=12dp)
- [ ] `ui/theme/Theme.kt` — LedgerTheme con colores estáticos (no Dynamic Color en MVP)

### Internacionalización

- [ ] `res/values/strings.xml` — inglés (default)
- [ ] `res/values-es/strings.xml` — español
- [ ] Todos los strings de UI en ambos archivos desde el principio

### Hilt — DI

- [ ] `App.kt` — `@HiltAndroidApp`
- [ ] `di/AppModule.kt` — provee `Context`, `OkHttpClient`, `Retrofit` (URL dinámica desde `ConfigStore`)
- [ ] `di/DatabaseModule.kt` — provee `AppDatabase`, DAOs
- [ ] `di/DataStoreModule.kt` — provee `TokenStore`, `ConfigStore`
- [ ] `di/RepositoryModule.kt` — bindings interfaces → implementaciones
- [ ] `di/WorkerModule.kt` — Hilt Worker factory para `SyncWorker`

### Room — Base de datos local

- [ ] `data/local/room/entity/TripEntity.kt`
- [ ] `data/local/room/entity/ExpenseEntity.kt`
- [ ] `data/local/room/entity/PendingOperationEntity.kt`
- [ ] `data/local/room/dao/TripDao.kt` — CRUD + Flow
- [ ] `data/local/room/dao/ExpenseDao.kt` — CRUD + Flow por trip_id y fecha
- [ ] `data/local/room/dao/PendingOperationDao.kt` — insert, getByStatus, updateStatus, deleteOlderThan
- [ ] `data/local/room/AppDatabase.kt` — Room database con las 3 entidades + migration strategy

### DataStore y ConfigStore

- [ ] `data/local/datastore/TokenStore.kt` — EncryptedSharedPreferences: access_token, refresh_token
- [ ] `data/local/datastore/ConfigStore.kt` — EncryptedSharedPreferences: server_url, invite_code, last_email

### Retrofit — Red

- [ ] `data/remote/api/AuthApi.kt` — login, register, refresh, logout, validate-invite
- [ ] `data/remote/api/TripApi.kt` — CRUD trips
- [ ] `data/remote/api/ExpenseApi.kt` — CRUD expenses + upload receipt
- [ ] `data/remote/api/SyncApi.kt` — pull?since= y push
- [ ] `data/remote/interceptor/AuthInterceptor.kt` — attach Bearer + refresh automático en 401
- [ ] DTOs: `TripDto.kt`, `ExpenseDto.kt`, `OcrResultDto.kt`, `SyncDto.kt`, `AuthDto.kt`
- [ ] Configurar `Retrofit` con URL dinámica: base URL se lee de `ConfigStore` al inicializar

### Network Monitor

- [ ] `util/NetworkMonitor.kt` — `Flow<Boolean>` con `ConnectivityManager.NetworkCallback`
- [ ] Inyectado por Hilt como Singleton

### Navegación base

- [ ] `presentation/navigation/Screen.kt` — sealed class con todos los destinos
- [ ] `presentation/navigation/AppNavGraph.kt` — grafo completo (con pantallas stub)
- [ ] `presentation/MainActivity.kt` — Single Activity + `@AndroidEntryPoint`

### SplashScreen y ConfigScreen

- [ ] `core-splashscreen` configurado en `AndroidManifest.xml`
- [ ] `presentation/screen/splash/SplashViewModel.kt` — lógica de enrutamiento inicial
- [ ] `presentation/screen/splash/SplashScreen.kt`
- [ ] `presentation/screen/config/ConfigViewModel.kt` — validar URL + validate-invite
- [ ] `presentation/screen/config/ConfigScreen.kt` — URL + invite code + botón Continuar

### AndroidManifest

- [ ] Permisos: INTERNET, ACCESS_NETWORK_STATE, CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE
- [ ] FileProvider configurado
- [ ] `res/xml/file_paths.xml`
- [ ] `network_security_config.xml` — cleartext solo para localhost/debug

### Utilidades

- [ ] `util/UuidGenerator.kt` — `UUID.randomUUID().toString()`
- [ ] `util/DateFormatter.kt` — formateo con locale del dispositivo
- [ ] `util/CurrencyFormatter.kt` — símbolo nativo + ISO para ambiguos

---

## 🔐 PHASE A2 — Auth Flow

> Login, register, sesión persistente, auto-login, logout.

### Domain

- [ ] `domain/model/User.kt` — id, email, name, currencyBase
- [ ] `domain/usecase/auth/LoginUseCase.kt`
- [ ] `domain/usecase/auth/RegisterUseCase.kt`
- [ ] `domain/usecase/auth/LogoutUseCase.kt`
- [ ] `domain/usecase/auth/RefreshTokenUseCase.kt`

### Data

- [ ] `data/repository/AuthRepository.kt` — login, register, refresh, logout, clearTokens
- [ ] Mappers: `AuthDto → User`

### Presentation

- [ ] `presentation/screen/auth/login/LoginViewModel.kt` — UiState sealed class
- [ ] `presentation/screen/auth/login/LoginScreen.kt` — email (pre-rellenado) + password + toggle show/hide + CTA
- [ ] `presentation/screen/auth/register/RegisterViewModel.kt` — validación confirm_password client-side
- [ ] `presentation/screen/auth/register/RegisterScreen.kt` — nombre + email + currency_base + password + confirm

### SplashViewModel — lógica completa

- [ ] Check ConfigStore → si no hay URL → ConfigScreen
- [ ] Check TokenStore → si no hay tokens → LoginScreen
- [ ] Si tokens → intentar refresh → si OK → TripsScreen; si falla → LoginScreen

### Logout

- [ ] `SettingsViewModel.kt` — lógica de logout con check PendingOperations
- [ ] Diálogo de confirmación si hay ops pendientes (Opción B)
- [ ] Al confirmar logout: borrar tokens, Room, pending_uploads, navegar a LoginScreen

### Tests

- [ ] `LoginViewModel_Test.kt` — estados Loading, Success, Error
- [ ] `RegisterViewModel_Test.kt` — validación confirm_password, campos obligatorios
- [ ] `AuthRepository_Test.kt` — mock AuthApi, verificar guardado de tokens

---

## ✈️ PHASE A3 — Trip Management

> Lista de viajes, crear viaje, active trip resolver. Offline-first.

### Domain

- [ ] `domain/model/Trip.kt` — id, name, destination, startDate, endDate, primaryCurrency, budget, budgetCurrency, status
- [ ] `domain/usecase/trip/GetTripsUseCase.kt` — Flow desde Room
- [ ] `domain/usecase/trip/GetActiveTripUseCase.kt` — trip cuyo rango incluye today
- [ ] `domain/usecase/trip/CreateTripUseCase.kt` — UUID en cliente + Room + encola op

### Data

- [ ] `data/repository/TripRepository.kt` — offline-first: Room como fuente, remote como sync
- [ ] `TripEntity ↔ Trip` mappers
- [ ] `TripDto ↔ TripEntity` mappers

### Presentation

- [ ] `presentation/screen/trips/list/TripsViewModel.kt`
- [ ] `presentation/screen/trips/list/TripsScreen.kt` — Variante C (activo hero + scroll demás)
- [ ] `presentation/screen/trips/create/CreateTripViewModel.kt` — UUID generado en cliente
- [ ] `presentation/screen/trips/create/CreateTripScreen.kt` — nombre, destino, fechas, moneda, presupuesto

### Componentes

- [ ] `component/TripCard.kt` — hero card (activo) + card normal (otros)
- [ ] `component/BudgetProgressBar.kt` — reutilizable en TripCard y TripDetailScreen
- [ ] `component/SyncStatusIndicator.kt` — icono ☁️N en TopBar

### Tests

- [ ] `TripsViewModel_Test.kt`
- [ ] `CreateTripViewModel_Test.kt` — verifica que se genera UUID en cliente
- [ ] `TripRepository_Test.kt` — offline create, Room cache

---

## 💶 PHASE A4 — Quick Capture

> La pantalla más importante. Escribir gastos offline-first con conversión live.

### Domain

- [ ] `domain/model/Expense.kt` — id, tripId, amount, currency, amountBase, rateDate, category, description, date, billable, paperlessDocId
- [ ] `domain/usecase/expense/CreateExpenseUseCase.kt` — UUID cliente + Room + encola op
- [ ] `domain/usecase/expense/GetExpensesUseCase.kt` — Flow por tripId y fecha
- [ ] `domain/usecase/expense/UpdateExpenseUseCase.kt`
- [ ] `domain/usecase/expense/DeleteExpenseUseCase.kt`
- [ ] `domain/usecase/currency/GetExchangeRateUseCase.kt` — cache en Room, fallback remoto

### Data

- [ ] `data/repository/ExpenseRepository.kt` — write-through offline-first
- [ ] `ExpenseEntity ↔ Expense` mappers
- [ ] `ExpenseDto ↔ ExpenseEntity` mappers
- [ ] `data/remote/api/CurrencyApi.kt` — GET /api/currencies/convert
- [ ] Room: añadir `ExchangeRateEntity` + `ExchangeRateDao`

### SyncWorker — implementación completa

- [ ] `sync/SyncWorker.kt` — procesado por dependencias
- [ ] Trigger on-demand al encolar op nueva
- [ ] Trigger periódico cada 30 min
- [ ] Backoff exponencial en reintentos
- [ ] Limpieza de ops `done` con más de 7 días
- [ ] Pull desde backend tras push (GET /api/sync/pull?since=)

### Presentation

- [ ] `presentation/screen/expense/capture/QuickCaptureViewModel.kt`
  - Conversión live amount → amountBase
  - Categoría default Dining
  - Billable default true
  - Modo edición (si viene de OCR: pre-rellenado)
  - UUID generado antes de guardar
- [ ] `presentation/screen/expense/capture/QuickCaptureScreen.kt`
  - Importe XXL 64sp (font-headline extrabold)
  - Auto-foco al abrir
  - Selector de moneda con conversión live
  - CategoryChips scrollables
  - Toggle billable
  - Bottom bar: Escanear + Guardar

### TripDetailScreen — base

- [ ] `presentation/screen/trips/detail/TripDetailViewModel.kt`
  - Gastos agrupados por día
  - Día activo (hoy si está en el rango del trip)
  - Lógica "saltar al día del gasto al guardar"
- [ ] `presentation/screen/trips/detail/TripDetailScreen.kt`
  - HorizontalPager (un page = un día)
  - DayChipStrip sincronizado con pager
  - Progress bar global del trip
  - Bottom bar: Escanear + Gasto
  - Pull-to-refresh

### Componentes

- [ ] `component/ExpenseCard.kt` — icono categoría + importe + moneda + hora
- [ ] `component/DayChipStrip.kt` — chips scrollables, chip activo marcado
- [ ] `component/CategoryChips.kt` — reutilizable en QuickCapture y filtros

### Tests

- [ ] `QuickCaptureViewModel_Test.kt` — conversión live, UUID en cliente, optimistic UI
- [ ] `ExpenseRepository_Test.kt` — write-through, encolado PendingOperation
- [ ] `SyncWorker_Test.kt` — orden de procesado, reintentos, backoff

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
