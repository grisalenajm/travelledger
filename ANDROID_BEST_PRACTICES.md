# ANDROID_BEST_PRACTICES.md — Ledger Android

> Normas obligatorias para agentes que trabajen en la app Android.
> Complementa `BEST_PRACTICES.md` global. Leer ambos antes de escribir código.

---

## 🏗️ Arquitectura MVVM + Clean

### Regla de oro: cada capa solo conoce la de abajo

```
Screen → ViewModel → UseCase → Repository → (Room | Retrofit)
```

```kotlin
// ✅ CORRECTO — Screen observa ViewModel
@Composable
fun TripsScreen(viewModel: TripsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // solo UI
}

// ❌ INCORRECTO — Screen llama repositorio directamente
@Composable
fun TripsScreen(repository: TripRepository) {
    val trips = repository.getTrips() // NUNCA
}
```

### UiState — patrón sealed class obligatorio

```kotlin
// ✅ CORRECTO
sealed class TripsUiState {
    object Loading : TripsUiState()
    data class Success(val trips: List<Trip>, val activeTrip: Trip?) : TripsUiState()
    data class Error(val message: String) : TripsUiState()
}

// ✅ ViewModel con StateFlow
@HiltViewModel
class TripsViewModel @Inject constructor(
    private val getTrips: GetTripsUseCase,
    private val getActiveTrip: GetActiveTripUseCase,
) : ViewModel() {

    private val _uiState = MutableStateFlow<TripsUiState>(TripsUiState.Loading)
    val uiState: StateFlow<TripsUiState> = _uiState.asStateFlow()

    init { loadTrips() }

    private fun loadTrips() {
        viewModelScope.launch {
            getTrips().collect { trips ->
                _uiState.value = TripsUiState.Success(
                    trips = trips,
                    activeTrip = getActiveTrip(trips)
                )
            }
        }
    }
}
```

### UseCases — una responsabilidad, operator fun invoke

```kotlin
// ✅ CORRECTO
class CreateExpenseUseCase @Inject constructor(
    private val expenseRepository: ExpenseRepository,
    private val currencyRepository: CurrencyRepository,
) {
    suspend operator fun invoke(form: ExpenseForm): Result<Expense> {
        val rate = currencyRepository.getRate(form.currency, form.userCurrencyBase, form.date)
        val expense = Expense(
            id = UuidGenerator.generate(),    // ← siempre en cliente
            tripId = form.tripId,
            amount = form.amount,
            currency = form.currency,
            amountBase = form.amount * rate.rate,
            rateDate = form.date,
            category = form.category,
            description = form.description,
            date = form.date,
            billable = form.billable,
        )
        return expenseRepository.create(expense)
    }
}
```

---

## 🗄️ Room — Patrones obligatorios

### Tres clases por entidad (Entity, Dto, Domain Model)

```kotlin
// 1. Entity (Room) — solo Room annotations
@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val tripId: String,
    val amount: Double,
    val currency: String,
    val amountBase: Double,
    val rateDate: String,                    // ISO 8601
    val category: String,
    val description: String?,
    val date: String,                        // ISO 8601
    val billable: Boolean,
    val paperlessDocId: Int?,
    val syncPending: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

// 2. Dto (Retrofit JSON)
@Serializable
data class ExpenseDto(
    val id: String,
    val trip_id: String,
    val amount: Double,
    val currency: String,
    val amount_base: Double,
    val rate_date: String,
    val category: String,
    val description: String?,
    val date: String,
    val billable: Boolean,
    val paperless_doc_id: Int?,
    val created_at: String,
    val updated_at: String,
)

// 3. Domain Model (lógica pura — sin annotations)
data class Expense(
    val id: String,
    val tripId: String,
    val amount: Double,
    val currency: String,
    val amountBase: Double,
    val rateDate: LocalDate,
    val category: ExpenseCategory,
    val description: String?,
    val date: LocalDate,
    val billable: Boolean,
    val paperlessDocId: Int?,
)
```

### DAOs — Flow para reactividad

```kotlin
@Dao
interface ExpenseDao {
    @Query("""
        SELECT * FROM expenses 
        WHERE tripId = :tripId AND date = :date 
        ORDER BY createdAt DESC
    """)
    fun getExpensesByTripAndDate(tripId: String, date: String): Flow<List<ExpenseEntity>>

    @Query("SELECT * FROM expenses WHERE tripId = :tripId ORDER BY date DESC, createdAt DESC")
    fun getExpensesByTrip(tripId: String): Flow<List<ExpenseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(expense: ExpenseEntity)

    @Update
    suspend fun update(expense: ExpenseEntity)

    @Delete
    suspend fun delete(expense: ExpenseEntity)

    @Query("SELECT * FROM expenses WHERE id = :id")
    suspend fun getById(id: String): ExpenseEntity?
}
```

### Mappers — extensiones de conversión

```kotlin
// Extensiones en archivo separado: ExpenseMappers.kt
fun ExpenseEntity.toDomain() = Expense(
    id = id,
    tripId = tripId,
    amount = amount,
    currency = currency,
    amountBase = amountBase,
    rateDate = LocalDate.parse(rateDate),
    category = ExpenseCategory.valueOf(category),
    description = description,
    date = LocalDate.parse(date),
    billable = billable,
    paperlessDocId = paperlessDocId,
)

fun Expense.toEntity(syncPending: Boolean = false) = ExpenseEntity(
    id = id,
    tripId = tripId,
    amount = amount,
    currency = currency,
    amountBase = amountBase,
    rateDate = rateDate.toString(),
    category = category.name,
    description = description,
    date = date.toString(),
    billable = billable,
    paperlessDocId = paperlessDocId,
    syncPending = syncPending,
)

fun ExpenseDto.toEntity() = ExpenseEntity(
    id = id,
    tripId = trip_id,
    amount = amount,
    currency = currency,
    amountBase = amount_base,
    rateDate = rate_date,
    category = category,
    description = description,
    date = date,
    billable = billable,
    paperlessDocId = paperless_doc_id,
    syncPending = false,
)
```

---

## 🔄 Offline-First — Patrón write-through

```kotlin
// ✅ CORRECTO — repositorio offline-first
class ExpenseRepositoryImpl @Inject constructor(
    private val expenseDao: ExpenseDao,
    private val pendingOperationDao: PendingOperationDao,
    private val expenseApi: ExpenseApi,
    private val syncManager: SyncManager,
) : ExpenseRepository {

    override suspend fun create(expense: Expense): Result<Expense> {
        return try {
            // 1. Guardar en Room PRIMERO (optimistic)
            expenseDao.upsert(expense.toEntity(syncPending = true))

            // 2. Encolar operación de sync
            pendingOperationDao.insert(
                PendingOperationEntity(
                    operationId = expense.id,          // idempotency key
                    type = "create_expense",
                    payload = expense.toJson(),
                    createdAt = System.currentTimeMillis(),
                )
            )

            // 3. Intentar sync inmediato si hay red
            syncManager.triggerOnDemand()

            Result.success(expense)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getExpensesByDay(tripId: String, date: LocalDate): Flow<List<Expense>> {
        return expenseDao
            .getExpensesByTripAndDate(tripId, date.toString())
            .map { entities -> entities.map { it.toDomain() } }
    }
}
```

### UUIDs siempre en cliente

```kotlin
// ✅ CORRECTO — UUID antes de persistir
object UuidGenerator {
    fun generate(): String = UUID.randomUUID().toString()
}

// En UseCase:
val expense = Expense(
    id = UuidGenerator.generate(),    // ← generado ANTES de Room y red
    ...
)
expenseRepository.create(expense)
```

---

## 🌐 Retrofit — Patrones obligatorios

### Interfaz tipada con suspend functions

```kotlin
interface ExpenseApi {
    @GET("api/expenses")
    suspend fun getExpenses(
        @Query("trip_id") tripId: String,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): List<ExpenseDto>

    @POST("api/expenses")
    suspend fun createExpense(@Body body: ExpenseCreateDto): ExpenseDto

    @PUT("api/expenses/{id}")
    suspend fun updateExpense(
        @Path("id") id: String,
        @Body body: ExpenseUpdateDto,
    ): ExpenseDto

    @DELETE("api/expenses/{id}")
    suspend fun deleteExpense(@Path("id") id: String)

    @Multipart
    @POST("api/receipts/upload")
    suspend fun uploadReceipt(
        @Part file: MultipartBody.Part,
    ): OcrResultDto
}
```

### URL dinámica desde ConfigStore

```kotlin
// di/AppModule.kt
@Provides
@Singleton
fun provideRetrofit(
    okHttpClient: OkHttpClient,
    configStore: ConfigStore,
): Retrofit {
    val baseUrl = runBlocking { configStore.getServerUrl() } 
        ?: "http://localhost:8000/"    // fallback para evitar crash si no hay config
    
    return Retrofit.Builder()
        .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
        .client(okHttpClient)
        .addConverterFactory(
            Json { ignoreUnknownKeys = true }.asConverterFactory("application/json".toMediaType())
        )
        .build()
}
```

**Atención:** si el usuario cambia la URL en Settings, hay que recrear Retrofit. Usar un wrapper que re-inicializa el cliente cuando cambia la URL.

---

## 🎨 Compose — Patrones obligatorios

### Composables stateless + stateful

```kotlin
// ✅ Stateless (testeable, previewable)
@Composable
fun ExpenseCard(
    expense: Expense,
    onTap: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    // solo UI, sin lógica
}

// ✅ Stateful (conectada al ViewModel)
@Composable
fun ExpenseCardStateful(
    expenseId: String,
    viewModel: TripDetailViewModel = hiltViewModel(),
) {
    val expense by viewModel.getExpense(expenseId).collectAsStateWithLifecycle()
    expense?.let {
        ExpenseCard(
            expense = it,
            onTap = { viewModel.onExpenseTap(expenseId) }
        )
    }
}

// ✅ Preview
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_NO)
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun ExpenseCardPreview() {
    LedgerTheme {
        ExpenseCard(
            expense = Expense.preview(),
            onTap = {}
        )
    }
}
```

### collectAsStateWithLifecycle (siempre, no collectAsState)

```kotlin
// ✅ CORRECTO — respeta lifecycle
val uiState by viewModel.uiState.collectAsStateWithLifecycle()

// ❌ INCORRECTO — no respeta lifecycle
val uiState by viewModel.uiState.collectAsState()
```

### LaunchedEffect para efectos únicos

```kotlin
// ✅ CORRECTO — auto-foco al abrir QuickCaptureScreen
val focusRequester = remember { FocusRequester() }
LaunchedEffect(Unit) {
    delay(100)    // pequeño delay para que el teclado emerja correctamente
    focusRequester.requestFocus()
}
```

### animateContentSize para conversión live

```kotlin
// En QuickCaptureScreen
Text(
    text = "→ ${formattedAmountBase}",
    modifier = Modifier.animateContentSize(),
    style = MaterialTheme.typography.bodyMedium,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
)
```

---

## 📸 CameraX — Patrones

```kotlin
// ✅ Patrón para captura de imagen
class CameraManager @Inject constructor(
    private val context: Context,
) {
    private var imageCapture: ImageCapture? = null

    fun startCamera(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView,
        onReady: () -> Unit,
    ) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }
            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                lifecycleOwner,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                imageCapture,
            )
            onReady()
        }, ContextCompat.getMainExecutor(context))
    }

    fun takePicture(
        outputDir: File,
        onSuccess: (File) -> Unit,
        onError: (Exception) -> Unit,
    ) {
        val file = File(outputDir, "${UuidGenerator.generate()}.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(file).build()
        imageCapture?.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) = onSuccess(file)
                override fun onError(exc: ImageCaptureException) = onError(exc)
            }
        )
    }
}
```

---

## 🔐 Seguridad

### EncryptedSharedPreferences

```kotlin
// ✅ CORRECTO
class TokenStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "ledger_tokens",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    suspend fun getAccessToken(): String? = withContext(Dispatchers.IO) {
        prefs.getString("access_token", null)
    }

    suspend fun saveTokens(accessToken: String, refreshToken: String) = withContext(Dispatchers.IO) {
        prefs.edit {
            putString("access_token", accessToken)
            putString("refresh_token", refreshToken)
        }
    }

    suspend fun clearTokens() = withContext(Dispatchers.IO) {
        prefs.edit { clear() }
    }
}
```

### Nunca loggear tokens ni datos sensibles

```kotlin
// ❌ INCORRECTO
Log.d("Auth", "Token: $accessToken")

// ✅ CORRECTO
Log.d("Auth", "Token guardado correctamente")
```

---

## 🧪 Tests

### ViewModel con Turbine + coroutines-test

```kotlin
@OptIn(ExperimentalCoroutinesApi::class)
class QuickCaptureViewModelTest {

    @get:Rule
    val coroutineRule = MainCoroutineRule()

    private val fakeCreateExpense = FakeCreateExpenseUseCase()
    private lateinit var viewModel: QuickCaptureViewModel

    @Before
    fun setUp() {
        viewModel = QuickCaptureViewModel(fakeCreateExpense)
    }

    @Test
    fun `guardar gasto exitoso actualiza uiState a Success`() = runTest {
        viewModel.uiState.test {
            assertIs<QuickCaptureUiState.Idle>(awaitItem())
            viewModel.onSave(validExpenseForm)
            assertIs<QuickCaptureUiState.Saving>(awaitItem())
            assertIs<QuickCaptureUiState.Saved>(awaitItem())
        }
    }

    @Test
    fun `UUID se genera en cliente, no depende del servidor`() = runTest {
        viewModel.onSave(validExpenseForm)
        val capturedExpense = fakeCreateExpense.lastInvokedWith
        assertNotNull(capturedExpense?.id)
        assertTrue(capturedExpense?.id?.isNotBlank() == true)
    }
}
```

### Naming de tests

```
`[método] [escenario] [resultado esperado]`

✅ `guardar gasto exitoso actualiza uiState a Success`
✅ `UUID se genera en cliente, no depende del servidor`
✅ `guardar gasto sin importe desactiva botón`
❌ `test1`
❌ `testCreateExpense`
```

### Fakes sobre Mocks cuando sea posible

```kotlin
// ✅ Preferible — Fake determinista
class FakeExpenseRepository : ExpenseRepository {
    val expenses = mutableListOf<Expense>()

    override suspend fun create(expense: Expense): Result<Expense> {
        expenses.add(expense)
        return Result.success(expense)
    }

    override fun getExpensesByDay(tripId: String, date: LocalDate): Flow<List<Expense>> {
        return flowOf(expenses.filter { it.tripId == tripId && it.date == date })
    }
}

// ⚠️ Aceptable — Mock cuando Fake sería muy complejo
val mockRepository = mockk<ExpenseRepository>()
coEvery { mockRepository.create(any()) } returns Result.success(fakeExpense)
```

---

## 🌍 Internacionalización

### Siempre usar strings.xml, nunca strings hardcoded en UI

```kotlin
// ❌ INCORRECTO
Text("Guardar gasto")

// ✅ CORRECTO
Text(stringResource(R.string.save_expense))
```

### Formato de fechas con locale del dispositivo

```kotlin
// ✅ CORRECTO
fun LocalDate.toDisplayString(): String {
    val formatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)
        .withLocale(Locale.getDefault())
    return format(formatter)
}

// ❌ INCORRECTO — formato fijo
fun LocalDate.toDisplayString() = "$dayOfMonth/$monthValue/$year"
```

### Formato de importes con locale

```kotlin
// ✅ CORRECTO
fun Double.toCurrencyString(currencyCode: String): String {
    return try {
        val currency = Currency.getInstance(currencyCode)
        val format = NumberFormat.getCurrencyInstance(Locale.getDefault())
        format.currency = currency
        format.format(this)
    } catch (e: Exception) {
        "$currencyCode ${String.format("%.2f", this)}"
    }
}
```

---

## 🐛 Debugging y Logging

```kotlin
// ✅ Usar Timber (o Log con tag consistente)
Timber.d("SyncWorker: procesando %d operaciones pendientes", pendingOps.size)
Timber.e(exception, "SyncWorker: error al procesar operación %s", op.operationId)

// En builds de release, Timber NO loggea por defecto
// En App.kt:
if (BuildConfig.DEBUG) {
    Timber.plant(Timber.DebugTree())
}
```

---

## 📝 Git y Commits

Conventional Commits para Android:

```bash
# ✅ CORRECTO
feat(android): add QuickCaptureScreen with live currency conversion
feat(android): implement SyncWorker with exponential backoff
fix(android): fix UUID generation race condition in ExpenseRepository
test(android): add QuickCaptureViewModel unit tests

# ❌ INCORRECTO
fix stuff
android update
wip
```

**Nunca commitear:**
- `google-services.json`
- `local.properties`
- `*.keystore` o `*.jks`
- `app/release/`
- `.env` files
