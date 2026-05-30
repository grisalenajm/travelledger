# ANDROID_ARCHITECTURE.md — Ledger Android

> Documento de referencia para agentes Claude Code que trabajen en la app Android.
> Leer completo antes de tocar cualquier fichero del proyecto Android.
> Todas las decisiones aquí documentadas fueron tomadas en sesión de diseño con el propietario.
> Si algo en tu tarea contradice este documento, consulta antes de proceder.

---

## 🎯 Visión del Producto Android

**Ledger Android** es una app de captura de gastos de viaje estilo **Trabee Pocket** con OCR de tickets vía Claude Haiku.

**Filosofía central:**
- La app es la herramienta de **captura en el terreno** — rápida, offline-first, diseñada para una mano.
- La web es la herramienta de **gestión profunda** — export masivo, configuración, edición detallada.
- El backend es la **fuente de verdad** — todos los datos viven allí, todos los clientes lo consultan.

**Diferenciadores respecto a Trabee Pocket:**
- 📸 OCR de ticket → gasto automático (Claude Haiku Vision vía backend).
- 🧾 Almacenaje de facturas en Paperless-ngx para reporting corporativo.
- 💼 Flag billable + export CSV/ZIP para Concur/SAP (solo online).
- 🔄 Sincronización con web app y bot Telegram.

---

## 🏗️ Distribución y Privacidad

### Modelo de distribución: App Privada (Camino 1)

- **La app NO se publica en Google Play** en MVP.
- Distribución via APK firmado: USB, Telegram personal, Firebase App Distribution (hasta 100 testers).
- Acceso controlado por `REGISTRATION_INVITE_CODE` en el backend.
- El APK **no lleva URL hardcoded** — el usuario la configura en el primer arranque.

### Apertura futura a la comunidad

Diseñada para soportarlo sin cambios de código:
- Cada usuario monta su propio backend (Docker Compose publicado en GitHub).
- Configura su propia URL e invite code en el primer arranque.
- Sin backend central compartido — cada instancia es independiente.

### Seguridad de registro

```
POST /api/auth/validate-invite  ← valida invite code antes del formulario de registro
POST /api/auth/register         ← exige invite_code en el body
```

Rate limit en nginx-proxy-manager: 3 intentos/hora por IP para `/api/auth/register`.

---

## 📱 Arquitectura General

### Stack técnico

| Capa | Tecnología |
|------|-----------|
| Lenguaje | Kotlin |
| UI | Jetpack Compose + Material 3 |
| Arquitectura | MVVM + Clean Architecture |
| DI | Hilt |
| Navegación | Navigation Compose (Single Activity) |
| BD local | Room |
| Red | Retrofit + OkHttp + Kotlin Serialization |
| Auth storage | EncryptedSharedPreferences (Jetpack Security) |
| Sync background | WorkManager |
| Cámara | CameraX |
| Build | Gradle 8.x + Kotlin DSL |
| Min SDK | 26 (Android 8.0) |
| Target SDK | 34 (Android 14) |

### Capas de arquitectura

```
Presentation (Screens + ViewModels)
    ↕ StateFlow / UiState
Domain (UseCases + Domain Models)
    ↕
Data (Repositories)
    ↕           ↕
Room (local)   Retrofit (remoto)
```

**Reglas absolutas:**
- Los Composables **nunca** tienen lógica de negocio.
- Los ViewModels **nunca** importan clases de `android.view`.
- Los UseCases tienen un único método `operator fun invoke(...)`.
- Los Repositorios abstraen la fuente — Room es local, Retrofit es remoto.
- El cliente **genera todos los UUIDs** (offline-first, idempotencia garantizada).

---

## 📁 Estructura de Directorios

```
android/app/src/main/
├── AndroidManifest.xml
├── kotlin/com/ledger/app/
│   ├── App.kt                          ← @HiltAndroidApp
│   ├── data/
│   │   ├── local/
│   │   │   ├── room/
│   │   │   │   ├── AppDatabase.kt
│   │   │   │   ├── dao/
│   │   │   │   │   ├── TripDao.kt
│   │   │   │   │   ├── ExpenseDao.kt
│   │   │   │   │   └── PendingOperationDao.kt
│   │   │   │   └── entity/
│   │   │   │       ├── TripEntity.kt
│   │   │   │       ├── ExpenseEntity.kt
│   │   │   │       └── PendingOperationEntity.kt
│   │   │   └── datastore/
│   │   │       ├── TokenStore.kt       ← EncryptedSharedPreferences
│   │   │       └── ConfigStore.kt      ← URL backend + invite code
│   │   ├── remote/
│   │   │   ├── api/
│   │   │   │   ├── AuthApi.kt
│   │   │   │   ├── TripApi.kt
│   │   │   │   ├── ExpenseApi.kt
│   │   │   │   ├── SyncApi.kt
│   │   │   │   └── dto/
│   │   │   │       ├── TripDto.kt
│   │   │   │       ├── ExpenseDto.kt
│   │   │   │       ├── OcrResultDto.kt
│   │   │   │       └── SyncDto.kt
│   │   │   └── interceptor/
│   │   │       └── AuthInterceptor.kt  ← attach JWT + refresh en 401
│   │   └── repository/
│   │       ├── AuthRepository.kt
│   │       ├── TripRepository.kt
│   │       ├── ExpenseRepository.kt
│   │       └── SyncRepository.kt
│   ├── domain/
│   │   ├── model/
│   │   │   ├── Trip.kt
│   │   │   ├── Expense.kt
│   │   │   └── SyncStatus.kt
│   │   └── usecase/
│   │       ├── auth/
│   │       │   ├── LoginUseCase.kt
│   │       │   ├── RegisterUseCase.kt
│   │       │   └── LogoutUseCase.kt
│   │       ├── trip/
│   │       │   ├── GetTripsUseCase.kt
│   │       │   ├── CreateTripUseCase.kt
│   │       │   └── GetActiveTripUseCase.kt
│   │       └── expense/
│   │           ├── GetExpensesUseCase.kt
│   │           ├── CreateExpenseUseCase.kt
│   │           ├── UpdateExpenseUseCase.kt
│   │           └── DeleteExpenseUseCase.kt
│   ├── presentation/
│   │   ├── MainActivity.kt
│   │   ├── navigation/
│   │   │   ├── AppNavGraph.kt
│   │   │   └── Screen.kt              ← sealed class de destinos
│   │   ├── screen/
│   │   │   ├── splash/
│   │   │   │   ├── SplashScreen.kt
│   │   │   │   └── SplashViewModel.kt
│   │   │   ├── config/
│   │   │   │   ├── ConfigScreen.kt    ← URL backend + invite code (primer arranque)
│   │   │   │   └── ConfigViewModel.kt
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   ├── LoginScreen.kt
│   │   │   │   │   └── LoginViewModel.kt
│   │   │   │   └── register/
│   │   │   │       ├── RegisterScreen.kt
│   │   │   │       └── RegisterViewModel.kt
│   │   │   ├── trips/
│   │   │   │   ├── list/
│   │   │   │   │   ├── TripsScreen.kt
│   │   │   │   │   └── TripsViewModel.kt
│   │   │   │   ├── create/
│   │   │   │   │   ├── CreateTripScreen.kt
│   │   │   │   │   └── CreateTripViewModel.kt
│   │   │   │   └── detail/
│   │   │   │       ├── TripDetailScreen.kt  ← vista por días + HorizontalPager
│   │   │   │       └── TripDetailViewModel.kt
│   │   │   ├── expense/
│   │   │   │   ├── capture/
│   │   │   │   │   ├── QuickCaptureScreen.kt
│   │   │   │   │   └── QuickCaptureViewModel.kt
│   │   │   │   ├── camera/
│   │   │   │   │   ├── CameraScreen.kt
│   │   │   │   │   └── CameraViewModel.kt
│   │   │   │   └── processing/
│   │   │   │       ├── OcrProcessingScreen.kt
│   │   │   │       └── OcrProcessingViewModel.kt
│   │   │   ├── summary/
│   │   │   │   ├── SummaryScreen.kt
│   │   │   │   └── SummaryViewModel.kt
│   │   │   └── settings/
│   │   │       ├── SettingsScreen.kt
│   │   │       └── SettingsViewModel.kt
│   │   └── component/
│   │       ├── AppTopBar.kt
│   │       ├── AppBottomNav.kt
│   │       ├── TripCard.kt
│   │       ├── ExpenseCard.kt
│   │       ├── DayChipStrip.kt
│   │       ├── CategoryChips.kt
│   │       ├── SyncStatusIndicator.kt
│   │       ├── BudgetProgressBar.kt
│   │       └── LoadingState.kt
│   ├── di/
│   │   ├── AppModule.kt               ← Retrofit, OkHttp, base URL dinámica
│   │   ├── DatabaseModule.kt
│   │   ├── DataStoreModule.kt
│   │   ├── RepositoryModule.kt
│   │   └── UseCaseModule.kt
│   ├── sync/
│   │   └── SyncWorker.kt              ← WorkManager
│   └── util/
│       ├── NetworkMonitor.kt
│       ├── DateFormatter.kt
│       ├── CurrencyFormatter.kt
│       └── UuidGenerator.kt           ← UUID.randomUUID() centralizado
├── res/
│   ├── values/
│   │   └── strings.xml                ← inglés (default)
│   ├── values-es/
│   │   └── strings.xml                ← español
│   └── xml/
│       └── file_paths.xml             ← FileProvider paths
└── google-services.json               ← NO commitear (FCM, Phase A8)
```

---

## 🗺️ Flujo de Navegación

### Grafo de navegación

```
SplashDestination
  ├─ [no config] → ConfigDestination (primer arranque)
  │     └─ [config OK] → LoginDestination
  ├─ [tokens expirados] → LoginDestination
  └─ [tokens válidos] → TripsDestination (pantalla inicial post-login)

AuthGraph:
  LoginDestination → RegisterDestination
  RegisterDestination → LoginDestination

AppGraph (requiere auth):
  TripsDestination
    └─ TripDetailDestination (HorizontalPager por días)
         ├─ QuickCaptureDestination (FAB + Gasto)
         │    └─ CameraDestination (si pulsa Escanear)
         │         └─ OcrProcessingDestination
         │              └─ [vuelve a QuickCapture pre-rellenado]
         ├─ CameraDestination (FAB Escanear)
         └─ SummaryDestination (botón 📊 TopBar)
  SettingsDestination
    └─ [Cerrar sesión] → LoginDestination
```

### Transiciones

- `QuickCaptureDestination`: slide vertical desde abajo (efecto similar a bottom sheet, pero es pantalla completa).
- `CameraDestination`: fade (oscurece pantalla antes de abrir cámara).
- `OcrProcessingDestination`: fade.
- Resto: slide horizontal estándar de Navigation Compose.

---

## 📱 Pantallas — Especificaciones

### 1. SplashScreen

Usa `androidx.core:core-splashscreen`. En background:
1. Lee `ConfigStore` → ¿hay URL backend configurada?
2. Si no → navega a `ConfigDestination`.
3. Si sí → lee `TokenStore` → ¿hay tokens?
4. Si no → navega a `LoginDestination`.
5. Si sí → intenta refresh si access_token expirado.
6. Si refresh OK → navega a `TripsDestination`.
7. Si refresh falla → navega a `LoginDestination`.

### 2. ConfigScreen (primer arranque)

```
[Logo Ledger]

URL del servidor
┌────────────────────────┐
│ https://               │  ← obligatorio, valida formato URL
└────────────────────────┘

Código de invitación
┌────────────────────────┐
│                        │  ← obligatorio
└────────────────────────┘

[Continuar]  ← deshabilitado hasta que ambos campos son válidos

⚙️ Configurar servidor  ← link discreto (ya expandido si hay campos)
```

**Validación al pulsar Continuar:**
1. Formato URL válido (http:// o https://).
2. `GET {URL}/health` → si falla → error "No se puede conectar al servidor".
3. `POST {URL}/api/auth/validate-invite` con `{"code": "..."}` → si 403 → "Código inválido".
4. Si OK → guarda URL + code en `ConfigStore` → navega a `LoginDestination`.

**Nota:** una vez configurado, esta pantalla no vuelve a aparecer salvo que el usuario borre la configuración desde Settings.

### 3. LoginScreen

```
[Logo]

Email
┌────────────────────────┐
│                        │
└────────────────────────┘

Contraseña  [👁]
┌────────────────────────┐
│                        │
└────────────────────────┘

[INICIAR SESIÓN]

¿No tienes cuenta? Regístrate
```

- Email se pre-rellena si hubo un login exitoso previo (guardado en `ConfigStore`).
- Sesión se recuerda por defecto (opt-out). No hay checkbox "recordarme".
- Sin "Olvidé contraseña" en MVP (Future Evolution).
- POST /api/auth/login → guarda access_token + refresh_token en `TokenStore`.

### 4. RegisterScreen

```
Nombre
Email
Moneda base  [selector ISO, default EUR]
Contraseña   [👁]
Confirmar    [👁]

[CREAR CUENTA]

¿Ya tienes cuenta? Inicia sesión
```

- `confirm_password` validado client-side antes de enviar.
- `invite_code` incluido en el body automáticamente (viene de `ConfigStore`).
- Navega a `LoginDestination` tras registro exitoso (no auto-login).

### 5. TripsScreen (pantalla inicial post-login)

**Variante C — viaje activo destacado:**

```
[TopBar: Ledger + icono sync ☁️N si hay pendientes]

┌─ VIAJE EN CURSO ──────────────────┐
│  Tokio Octubre 2026                │  ← card grande hero
│  Día 3 · 14 oct                   │
│  CHF 1.247 / 5.000  (24%)         │
│  ▓▓▓▓░░░░░░░░░░░░░                │
│  [Continuar]                      │
└────────────────────────────────────┘

Otros viajes:
──────────────────────────────────
🔵 Buenos Aires Diciembre  (próximo)
⚪ Lisboa Septiembre        (finalizado)
⚪ París Junio              (finalizado)

[+ Crear nuevo viaje]
```

- Si no hay viaje activo → CTA "Crear tu primer viaje" en lugar de hero card.
- Si hay varios viajes activos (rango de fechas solapado) → todos aparecen en la sección hero como cards horizontales scrollables.
- Tap en viaje activo → `TripDetailDestination`.
- Tap en viaje pasado/próximo → `TripDetailDestination` (modo lectura, sin botón + Gasto).

### 6. TripDetailScreen (vista por días)

```
[TopBar: ← NombreViaje   ☁️N   ⚙️   📊]

CHF 1.247 / 5.000  (24%)
▓▓▓▓░░░░░░░░░░░░░░░                  ← progress bar global

◀ Día 1  Día 2  [Día 3]  Día 4 ▶    ← chip strip scrollable
          14 oct · hoy               ← indicador "hoy"

──────────────────────────────────────

🍽️ Le Bistrot Paris
   ¥ 12.450 · CHF 78,30 · 14:30

🏨 Hotel Shinjuku
   ¥ 18.500 · CHF 116,40 · 09:00

──────────────────
Total día 3: CHF 195,96

[📸 Escanear]        [+ Gasto]       ← bottom bar fixed
```

**HorizontalPager:** cada página = un día del trip.
**Chip strip:** sincronizado con el pager. Tap en chip = saltar a ese día. Swipe entre páginas = mover el chip activo.
**Días sin gastos:** se muestran con "Sin gastos este día. Pulsa + para añadir.".
**Al guardar un gasto con fecha distinta al día visible:** la vista salta al día del gasto.

### 7. QuickCaptureScreen

```
[TopBar: ✕   Día 3 · 14 oct]

     ¥                              ← símbolo moneda XXL
  12.450                            ← importe 64sp font-headline extrabold
                                       auto-foco al abrir

JPY ▼      → CHF 78,30             ← selector moneda + conversión live

──────────────────────────────────

Categoría
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
│🍽️ │ │🏨 │ │🚇 │ │🎭 │ │🛍️ │ ▶   ← chips scrollables
└───┘ └───┘ └───┘ └───┘ └───┘

Descripción
┌──────────────────────────────┐
│ Cena Le Bistrot Paris        │    ← opcional
└──────────────────────────────┘

💼 Facturable                 ✓     ← toggle, default ON

──────────────────────────────────
[📸 Escanear]     [   GUARDAR   ]  ← bottom bar fixed
                                      Guardar deshabilitado si importe = 0
```

**Categorías:** Dining 🍽️, Lodging 🏨, Transport 🚇, Culture 🎭, Shopping 🛍️, Health 💊, Other 📦.
**Moneda default:** `Trip.primary_currency`. El usuario puede cambiarla.
**Billable default:** `true`.
**Auto-foco:** el campo numérico recibe foco al abrir la pantalla → teclado del sistema emerge.
**Si viene de OCR:** campos pre-rellenados con `OcrResultDto`. El contexto de la TopBar muestra el día correspondiente a la fecha detectada por el OCR (no necesariamente el día visible en el pager).
**Guardar → Optimistic UI:** el gasto aparece en Room instantáneamente. Se encola `PendingOperation`. Si hay red, se sincroniza on-demand.

### 8. CameraScreen

```
[TopBar: ✕   🔦   ]

┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                                  │  ← viewfinder dashed
│    [imagen cámara live preview]  │     scanning line animada
│                                  │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

     Encuadra el ticket

🖼️               ⬤              ✓   ← galería, disparador, confirmar
```

**Captura única** (no ráfaga).
**Galería:** abre photo picker (imágenes + PDFs).
**Linterna:** toggle 🔦 en TopBar.
**Al disparar:** muestra preview estático de la foto capturada.

**Preview post-captura:**
```
[imagen capturada a pantalla completa]

[Reintentar]          [Procesar ▶]
```

Si "Procesar" → navega a `OcrProcessingDestination`.

### 9. OcrProcessingScreen

```
[TopBar: ✕   Procesando...]

┌──────────────────────────────────┐
│                                  │
│   [thumbnail ticket capturado]   │
│                                  │
│  ──── scanning line animada ──── │
│                                  │
└──────────────────────────────────┘

✓  Imagen guardada localmente
✓  Subiendo a servidor...
⏳ Analizando con IA...

                    [Cancelar]
```

**Checks van apareciendo** según progresa el proceso.
**Si hay red:** sube imagen al backend → OCR → vuelve a `QuickCaptureDestination` con datos.
**Si no hay red:**
```
❌ No se pudo procesar.
   Tu foto se ha guardado y se procesará
   cuando vuelvas a tener conexión.

[Continuar manualmente]   [Reintentar]
```
"Continuar manualmente" → `QuickCaptureDestination` con foto adjunta, campos vacíos.

### 10. SummaryScreen

```
[TopBar: ← Resumen]

Tokio Octubre 2026
12 - 19 oct · 7 días

Total gastado
CHF 3.247
de CHF 5.000 presupuestado (65%)

[donut chart por categoría - Compose Canvas]

🍽️ Dining       CHF 920   28%
🏨 Lodging      CHF 1.450  45%
🚇 Transport    CHF 540    17%
🛍️ Shopping     CHF 200    6%
🎭 Culture      CHF 137    4%

Por moneda:
¥ 245.000  (CHF 1.530)
$ 320      (CHF 285)

💼 Facturables:  CHF 2.890
🌟 Personales:   CHF 357

[Exportar CSV]    [Exportar ZIP]   ← solo online
```

**Export CSV/ZIP:** solo disponibles con red. Si offline, botones deshabilitados con tooltip "Necesitas conexión para exportar". Descarga del backend → guarda en `cacheDir/exports/` → share sheet.

### 11. SettingsScreen

```
[TopBar: ← Ajustes]

Perfil
  Nombre:        Jesus
  Email:         jesus@ejemplo.com
  Moneda base:   CHF  [editar]

Servidor
  URL:           https://ledger.tucasa.com
  [Cambiar servidor]   ← borra config + Room, vuelve a ConfigScreen

Sincronización
  [Ver estado de sincronización]   ← lista ops pendientes / fallidas

Sesión
  [Cerrar sesión]   ← con confirmación, Opción B si hay pendientes
```

---

## 🔄 Offline-First y Sincronización

### Principio fundamental

**Todo lo que escribe el usuario va a Room primero.** La red es secundaria. La cola se procesa en background.

### PendingOperation

```kotlin
@Entity("pending_operations")
data class PendingOperationEntity(
    @PrimaryKey val operationId: String,      // UUID generado en cliente
    val type: String,                          // ver tipos abajo
    val payload: String,                       // JSON de la operación
    val imagePath: String? = null,             // path local si hay imagen
    val createdAt: Long,
    val attempts: Int = 0,
    val lastAttemptAt: Long? = null,
    val lastError: String? = null,
    val status: String = "pending"             // pending | processing | failed | done
)
```

**Tipos de operación:**
```
create_trip     update_trip     delete_trip
create_expense  update_expense  delete_expense
upload_image
```

### Orden de procesado en SyncWorker

Procesado **por dependencias**, no FIFO estricto:
1. `create_trip` (antes que cualquier expense de ese trip)
2. `create_expense`
3. `upload_image`
4. `update_trip` / `update_expense`
5. `delete_expense` / `delete_trip`

### Triggers del SyncWorker

- **On-demand:** cada vez que se encola una nueva op y hay red.
- **Periódico:** cada 30 minutos si hay ops pendientes.
- **Pull-to-refresh:** manual del usuario en cualquier lista.

### Política de reintentos

- Máximo 5 intentos por operación.
- Backoff exponencial: 1min → 5min → 15min → 1h → 6h.
- Tras 5 fallos → estado `failed` → banner de alerta al usuario.

### Retención de ops completadas

- Ops en estado `done` se borran tras 7 días.
- Job de limpieza: se ejecuta al inicio del SyncWorker.

### UUIDs en cliente

**El cliente genera todos los UUIDs** antes de encolar la operación. El backend los respeta (acepta `id` opcional en POST). Esto garantiza:
- Offline create funciona sin esperar respuesta del servidor.
- Idempotencia: si la op se reintenta, el servidor no duplica el recurso.
- Las FKs son válidas en Room desde el primer momento.

### Conflictos

**Last write wins** basado en `updated_at`. Sin diálogos de conflicto al usuario.

### Comunicación al usuario

- **Indicador discreto ☁️N** en TopBar cuando hay ops pendientes.
- **Banner amarillo** cuando hay ops en estado `failed`.
- **Pantalla detallada** en Settings → Sincronización.

### Imágenes en la cola

Las imágenes capturadas se guardan en:
```
app/files/pending_uploads/{operationId}.jpg
app/files/pending_uploads/{operationId}.pdf
```

El payload de la PendingOperation contiene el path relativo. El SyncWorker lee el archivo y lo sube al backend.

---

## 📸 Flujo OCR Completo

```
TripDetailScreen
  ↓ tap "📸 Escanear"
CameraScreen
  ↓ captura foto
Preview "¿Procesar esta foto?"
  ↓ tap "Procesar"
OcrProcessingScreen
  ├─ [con red]
  │   ├─ Guarda imagen en pending_uploads/
  │   ├─ POST /api/receipts/upload (multipart)
  │   ├─ Recibe OcrResultDto
  │   └─ → QuickCaptureScreen pre-rellenada
  └─ [sin red]
      ├─ Guarda imagen en pending_uploads/
      ├─ Muestra error + opciones
      ├─ [Continuar manualmente] → QuickCaptureScreen vacía + foto adjunta
      └─ [Reintentar] → vuelve a intentar upload

QuickCaptureScreen (pre-rellenada o vacía)
  ↓ tap "GUARDAR"
  ├─ Guarda en Room (Optimistic UI)
  ├─ Encola PendingOperation create_expense
  └─ Vista por días salta al día del gasto (según fecha OCR o contexto)
```

### Mapeo de campos OcrResultDto → QuickCaptureScreen

| Campo OCR | Campo UI | Comportamiento |
|---|---|---|
| `amount` | Importe | ✅ Pre-rellena |
| `currency` | Moneda | ✅ Pre-rellena (se respeta aunque difiera del trip) |
| `category` | Categoría | ✅ Chip seleccionado |
| `description` / `merchant` | Descripción | ✅ Pre-rellena |
| `date` | Día del gasto | ✅ Si dentro del trip → usar; si fuera → fallback al día contexto |
| `paperless_doc_id` | Interno | 🔧 Guardado internamente, vinculado al expense |
| `confidence` | — | ❌ No se muestra al usuario |
| `payment_method` | — | ❌ No hay campo en MVP |

---

## 🔐 Autenticación y Seguridad

### Almacenamiento de tokens

```kotlin
// EncryptedSharedPreferences (Jetpack Security + Android Keystore)
TokenStore:
  - access_token       (String)
  - refresh_token      (String)

ConfigStore:
  - server_url         (String)
  - invite_code        (String)  ← solo para validate-invite, no se manda en cada request
  - last_email         (String)  ← pre-rellenar campo email en Login
```

### AuthInterceptor — refresh automático

```kotlin
class AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenStore.getAccessToken() }
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        var response = chain.proceed(request)

        if (response.code == 401) {
            val newToken = runBlocking {
                try { authRepository.refreshToken(); tokenStore.getAccessToken() }
                catch (e: Exception) { null }
            }
            if (newToken != null) {
                response.close()
                response = chain.proceed(
                    chain.request().newBuilder()
                        .addHeader("Authorization", "Bearer $newToken")
                        .build()
                )
            } else {
                // Refresh también falló → logout suave
                runBlocking { authRepository.clearTokens() }
                // Navegar a Login vía evento en el ViewModel / NavigationManager
            }
        }
        return response
    }
}
```

### Al recibir 401 definitivo (refresh fallido)

1. Borrar tokens de `TokenStore`.
2. NO borrar datos de Room (se reusan al volver a loguear).
3. NO borrar URL backend ni last_email.
4. Navegar a `LoginDestination`.
5. Toast: "Tu sesión ha caducado, vuelve a iniciar sesión".
6. Email pre-rellenado en LoginScreen con `last_email`.

### Al hacer logout explícito

Si hay `PendingOperation` pendientes:
```
"Tienes N cambios sin sincronizar.
 ¿Forzar sincronización antes de cerrar sesión?"
[Esperar y sincronizar]   [Cerrar de todas formas]
```

Si "Cerrar de todas formas":
1. Borrar tokens.
2. Borrar datos de Room (trips, expenses, pending_operations).
3. Borrar archivos en `pending_uploads/`.
4. Navegar a `LoginDestination`.

---

## 🌍 Internacionalización

- **Idiomas:** español (default) + inglés. `values/strings.xml` (EN) + `values-es/strings.xml` (ES).
- **Formato de fechas y números:** respetar locale del dispositivo (`DateTimeFormatter.ofLocalizedDate`, `NumberFormat`).
- **Excepción:** CSV de export usa formato del backend (punto decimal, ISO 8601) — no depende del locale.
- **Símbolos de moneda:** nativo cuando único (¥, €), código ISO cuando ambiguo (USD$, CAD$).
- **Mix currency_base + locale:** el usuario español con CHF ve "CHF 78,30" (coma decimal española, moneda elegida por el usuario).

---

## 📲 Permisos del Sistema

### Manifest

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" android:minSdkVersion="33" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
```

### Estrategia de solicitud

| Permiso | Cuándo pedir |
|---|---|
| INTERNET | Install-time, sin diálogo |
| ACCESS_NETWORK_STATE | Install-time, sin diálogo |
| CAMERA | Al pulsar "📸 Escanear" por primera vez |
| READ_MEDIA_IMAGES | Al pulsar "🖼️ Galería" por primera vez |

**Regla:** pedir el permiso **cuando el usuario entiende por qué lo necesitas**, no al arrancar.

**Si denegado dos veces:** mostrar mensaje con link a Ajustes del sistema.

### FileProvider (export)

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

---

## 📦 Dependencias Principales (Phase A1)

```kotlin
// build.gradle.kts (app)

// Splash
androidx.core:core-splashscreen:1.0.1

// Compose BOM
platform(androidx.compose:compose-bom:2024.02.00)
androidx.compose.ui:ui
androidx.compose.material3:material3
androidx.compose.material:material-icons-extended
androidx.compose.ui:ui-tooling-preview

// Navigation
androidx.navigation:navigation-compose:2.7.7

// Lifecycle
androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0
androidx.lifecycle:lifecycle-runtime-ktx:2.7.0

// Hilt
com.google.dagger:hilt-android:2.50
com.google.dagger:hilt-compiler:2.50
androidx.hilt:hilt-navigation-compose:1.2.0
androidx.hilt:hilt-work:1.2.0

// Room
androidx.room:room-runtime:2.6.1
androidx.room:room-ktx:2.6.1
kapt(androidx.room:room-compiler:2.6.1)

// DataStore + Security
androidx.datastore:datastore-preferences:1.0.0
androidx.security:security-crypto:1.1.0-alpha06

// WorkManager
androidx.work:work-runtime-ktx:2.9.0

// Retrofit + OkHttp
com.squareup.retrofit2:retrofit:2.11.0
com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0
com.squareup.okhttp3:okhttp:4.12.0
com.squareup.okhttp3:logging-interceptor:4.12.0

// Kotlin Serialization
org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3

// CameraX (Phase A5)
androidx.camera:camera-core:1.3.2
androidx.camera:camera-camera2:1.3.2
androidx.camera:camera-lifecycle:1.3.2
androidx.camera:camera-view:1.3.2

// Testing
junit:junit:4.13.2
androidx.test.ext:junit:1.1.5
androidx.compose.ui:ui-test-junit4
io.mockk:mockk:1.13.10
org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0
app.cash.turbine:turbine:1.0.0
```

---

## 🚀 Phases de Desarrollo Android

| Phase | Nombre | Contenido |
|---|---|---|
| **A1** | Foundation | Setup Gradle, Hilt, Compose, Room, Retrofit, Theme, Navigation base, SplashScreen, ConfigScreen |
| **A2** | Auth Flow | LoginScreen, RegisterScreen, AuthRepository, TokenStore, SplashScreen logic |
| **A3** | Trip Management | TripsScreen, CreateTripScreen, TripRepository offline-first, active trip resolver |
| **A4** | Quick Capture | QuickCaptureScreen, ExpenseRepository write-through, PendingOperation, SyncWorker |
| **A5** | Camera + OCR | CameraScreen, CameraX, OcrProcessingScreen, integración /api/receipts/upload |
| **A6** | Vista por Días + Detalle | TripDetailScreen HorizontalPager, ExpenseDetailScreen, filtro por categoría, pull-to-refresh |
| **A7** | Summary + Export | SummaryScreen, donut chart, export CSV/ZIP vía backend, FileProvider |
| **A8** | Polish + Future | FCM, biometría, dark mode, animaciones, TripLegs, Loyalty Cards, BYOK OCR |

---

## 🚫 Reglas Absolutas para Agentes Android

1. Nunca lógica de negocio en Composables — solo en ViewModel/UseCase.
2. Nunca `runBlocking` en el hilo principal salvo en `AuthInterceptor` (caso justificado).
3. Nunca `any` en Kotlin sin justificación explícita.
4. Nunca hardcodear URLs, strings de UI, o colores — usar `BuildConfig`, `strings.xml`, tokens de tema.
5. Nunca commitear `google-services.json`, `local.properties`, API keys, `.env`.
6. Nunca leer archivos de `pending_uploads/` en el hilo principal.
7. Nunca navegar desde un Repository o UseCase — solo desde ViewModel via eventos.
8. El cliente siempre genera UUIDs antes de persistir en Room.
9. Optimistic UI siempre — Room primero, red después.
10. Los permisos se piden en contexto, nunca al arrancar.
11. Export CSV/ZIP solo online — no generar en cliente.
12. OCR solo vía backend — no BYOK en MVP.
13. La URL del backend viene de `ConfigStore`, nunca hardcodeada en código.
