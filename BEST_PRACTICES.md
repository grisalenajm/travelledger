# BEST PRACTICES — Travel Expenses App

> Normas obligatorias para todos los agentes que trabajen en este proyecto.
> Si encuentras una norma que no tiene sentido en tu contexto, consúltalo antes de saltártela.

---

## 🐍 Backend — Python / FastAPI

### Estructura y organización

```python
# ✅ CORRECTO: lógica en service, router solo orquesta
@router.post("/", response_model=ExpenseRead, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await expense_service.create(db, user_id=current_user.id, data=data)

# ❌ INCORRECTO: lógica de negocio en el router
@router.post("/")
async def create_expense(data: ExpenseCreate, db: AsyncSession = Depends(get_db)):
    expense = Expense(**data.model_dump())
    db.add(expense)
    await db.commit()  # nunca en un router
```

### Tipado y Pydantic

- Usar **Pydantic v2** (`model_validator`, `field_validator`).
- Schemas separados: `XxxCreate`, `XxxUpdate`, `XxxRead`, `XxxInDB`.
- Nunca exponer `password_hash` ni tokens en schemas `Read`.

```python
class ExpenseCreate(BaseModel):
    amount: Decimal
    currency: str = Field(min_length=3, max_length=3)
    description: str | None = None
    date: date
    trip_id: UUID

class ExpenseRead(ExpenseCreate):
    id: UUID
    amount_base: Decimal
    paperless_doc_id: int | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
```

### Base de datos

- SQLAlchemy async (`AsyncSession`, `select()`, `scalars()`).
- UUID como PK. Timestamps `created_at` / `updated_at` con `server_default`.
- Queries complejas en el service, nunca en el router.

```python
class Expense(Base):
    __tablename__ = "expenses"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

### Sync endpoints — reglas especiales

- `POST /api/sync/push` debe ser **idempotente**: procesar la misma operación dos veces no duplica datos. Usar `operation_id` (UUID generado en el cliente) como clave de deduplicación.
- `GET /api/sync/pull?since={ts}` devuelve solo objetos modificados después del timestamp. Incluir `deleted_ids` para propagación de borrados.

```python
class PendingOperation(BaseModel):
    operation_id: UUID   # idempotency key
    type: Literal["create_expense", "update_expense", "delete_expense", ...]
    payload: dict
    client_timestamp: datetime
```

### Manejo de errores y logging

```python
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=f"Expense {expense_id} not found",
)

logger.info("OCR completed", extra={"receipt_id": str(receipt_id), "confidence": 0.92})
# Nunca usar print() en producción
```

### Tests

- pytest + pytest-asyncio. Fixtures en `conftest.py`.
- Naming: `test_<function>_<scenario>_<expected>`.
- Mocks para servicios externos (MinIO, Paperless, Claude API).

---

## 🤖 Android — Kotlin / Jetpack Compose

### Arquitectura MVVM + Clean (obligatoria)

```
Screen (Composable)   ←  solo UI, sin lógica
    ↕ observe StateFlow
ViewModel             ←  estado UI, llamadas a UseCase
    ↕
UseCase               ←  lógica de negocio pura, testeable
    ↕
Repository            ←  fuente de verdad, combina Room + Retrofit
    ↕ ↕
 Room   Retrofit      ←  detalles de implementación
```

**Reglas:**
- Los Composables **nunca** tienen lógica de negocio ni llaman a repositorios directamente.
- Los ViewModels **nunca** importan clases de `android.view` ni de Compose.
- Los UseCases son clases con un único método `operator fun invoke(...)`.
- Los Repositorios abstraen la fuente de datos: Room es la fuente local, Retrofit es remoto.

### UiState — patrón obligatorio

```kotlin
// ✅ Sealed class para estados de pantalla
sealed class TripListUiState {
    object Loading : TripListUiState()
    data class Success(val trips: List<Trip>) : TripListUiState()
    data class Error(val message: String) : TripListUiState()
}

// ✅ ViewModel con StateFlow
@HiltViewModel
class TripListViewModel @Inject constructor(
    private val getTrips: GetTripsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<TripListUiState>(TripListUiState.Loading)
    val uiState: StateFlow<TripListUiState> = _uiState.asStateFlow()

    init { loadTrips() }

    private fun loadTrips() {
        viewModelScope.launch {
            _uiState.value = try {
                TripListUiState.Success(getTrips())
            } catch (e: Exception) {
                TripListUiState.Error(e.message ?: "Error desconocido")
            }
        }
    }
}
```

### Composables

- Funciones pequeñas y enfocadas. Máximo ~80 líneas.
- Separar Composable de preview: una función stateless + una stateful.
- Siempre añadir `@Preview` con datos de muestra.

```kotlin
// ✅ Stateless (testeable, previewable)
@Composable
fun ExpenseCard(
    expense: Expense,
    onDelete: (String) -> Unit,
    modifier: Modifier = Modifier
) { ... }

// ✅ Preview
@Preview(showBackground = true)
@Composable
fun ExpenseCardPreview() {
    TravelExpensesTheme {
        ExpenseCard(
            expense = Expense.preview(),
            onDelete = {}
        )
    }
}
```

### Retrofit — reglas

```kotlin
// ✅ Interfaz tipada, suspend functions
interface ExpenseApi {
    @GET("expenses")
    suspend fun getExpenses(@Query("trip_id") tripId: String): List<ExpenseDto>

    @POST("expenses")
    suspend fun createExpense(@Body body: CreateExpenseRequest): ExpenseDto

    @Multipart
    @POST("receipts/upload")
    suspend fun uploadReceipt(
        @Part file: MultipartBody.Part
    ): OcrResultDto
}

// ✅ AuthInterceptor: attach + refresh automático
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { tokenStore.getAccessToken() }
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        val response = chain.proceed(request)
        if (response.code == 401) {
            // refresh y reintentar
        }
        return response
    }
}
```

### Room — reglas

```kotlin
// ✅ Entity con timestamps
@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val tripId: String,
    val amount: Double,
    val currency: String,
    val description: String?,
    val date: String,
    val syncPending: Boolean = false,    // marca operaciones offline
    val createdAt: Long = System.currentTimeMillis()
)

// ✅ DAO con Flow para reactividad
@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses WHERE tripId = :tripId ORDER BY date DESC")
    fun getExpensesByTrip(tripId: String): Flow<List<ExpenseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(expense: ExpenseEntity)

    @Delete
    suspend fun delete(expense: ExpenseEntity)
}
```

### CameraX + ML Kit

```kotlin
// ✅ Patrón para análisis de imagen
class ScannerViewModel @Inject constructor(
    private val scanReceipt: ScanReceiptUseCase
) : ViewModel() {

    fun analyzeImage(imageProxy: ImageProxy) {
        viewModelScope.launch {
            val result = scanReceipt(imageProxy)
            // result.confidence < 0.6 → escalar al servidor
            _uiState.value = if (result.confidence >= 0.6) {
                ScannerUiState.Success(result.toExpenseDraft())
            } else {
                ScannerUiState.NeedsServerFallback(result.rawText)
            }
            imageProxy.close()
        }
    }
}
```

### Offline sync — reglas

- **Toda escritura** se encola en `PendingOperation` ANTES de intentar la llamada de red.
- Si la red está disponible, intentar inmediatamente y limpiar la operación si éxito.
- Si la red no está disponible, `SyncWorker` procesará cuando recupere conexión.
- `operation_id` es UUID generado en el cliente, usado como clave de idempotencia en el servidor.

```kotlin
// ✅ Patrón write-through
suspend fun createExpense(expense: Expense) {
    val entity = expense.toEntity(syncPending = true)
    expenseDao.upsert(entity)                          // guardar local siempre
    enqueueOperation(                                  // encolar sync
        type = "create_expense",
        payload = expense.toJson(),
        operationId = expense.id
    )
    trySync()                                          // intentar ahora si hay red
}
```

### Tests Android

- **ViewModel tests**: usar `kotlinx-coroutines-test` + `Turbine` para StateFlow.
- **UseCase tests**: JUnit puro, sin Android framework.
- **Room tests**: `@RunWith(AndroidJUnit4::class)` con base de datos en memoria.
- **Compose tests**: `createComposeRule()` para UI testing.

```kotlin
@Test
fun `createExpense success updates uiState to Success`() = runTest {
    val viewModel = AddExpenseViewModel(fakeCreateExpense)
    viewModel.uiState.test {
        viewModel.submit(validExpenseForm)
        assertEquals(AddExpenseUiState.Loading, awaitItem())
        assertTrue(awaitItem() is AddExpenseUiState.Success)
    }
}
```

---

## ⚛️ Frontend Web — Next.js / TypeScript

### Tipado

- Strict mode activo. No usar `any`.
- Types compartidos en `types/`. No redefinir.

```typescript
interface Expense {
  id: string
  amount: number
  currency: string
  amountBase: number
  description: string | null
  date: string
  tripId: string
  paperlessDocId: number | null
  createdAt: string
}
```

### Componentes

- Server Components por defecto. `"use client"` solo cuando sea necesario.
- Props siempre tipadas con `interface`.
- Lógica compleja en custom hooks.

### Data Fetching

```typescript
// React Query para server data
export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: ['expenses', tripId],
    queryFn: () => api.expenses.list(tripId),
    staleTime: 1000 * 60 * 5,
  })
}

// Zustand solo para UI state global
const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}))
```

### Formularios

```typescript
const expenseSchema = z.object({
  amount: z.number().positive("El importe debe ser positivo"),
  currency: z.string().length(3, "Código ISO de 3 letras"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional(),
})
```

### Estilos

- Tailwind CSS siempre. `cn()` para clases condicionales.
- No escribir CSS custom salvo casos excepcionales.

---

## 📤 Export CSV — Normas de implementación

### Backend (`export_service.py`)

```python
import csv
import io
from fastapi.responses import StreamingResponse

async def export_expenses_csv(
    db: AsyncSession,
    trip_id: UUID,
    user_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
) -> StreamingResponse:
    expenses = await expense_service.list_for_export(
        db, trip_id=trip_id, user_id=user_id,
        date_from=date_from, date_to=date_to
    )
    trip = await trip_service.get(db, trip_id=trip_id, user_id=user_id)

    output = io.StringIO()
    output.write("\ufeff")  # BOM para compatibilidad Excel

    writer = csv.DictWriter(output, fieldnames=[
        "date", "description", "category", "amount", "currency",
        "amount_base", "base_currency", "payment_method", "paperless_url"
    ])
    writer.writeheader()

    paperless_base = settings.PAPERLESS_URL

    for expense in expenses:
        paperless_url = (
            f"{paperless_base}/documents/{expense.paperless_doc_id}/"
            if expense.paperless_doc_id else ""
        )
        writer.writerow({
            "date": expense.date.isoformat(),
            "description": expense.description or "",
            "category": expense.category,
            "amount": str(expense.amount),           # punto decimal, nunca coma
            "currency": expense.currency,
            "amount_base": str(expense.amount_base),
            "base_currency": trip.currency,
            "payment_method": expense.payment_method or "",
            "paperless_url": paperless_url,
        })

    filename = f"ledger_{trip.name.replace(' ', '_')}_{date.today().isoformat()}.csv"
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

**Reglas del CSV:**
- Usar `io.StringIO` + `StreamingResponse` — nunca escribir a disco.
- BOM `\ufeff` obligatorio para que Excel (Windows) abra sin configuración.
- Decimales siempre con punto (`.`), nunca con coma.
- Fechas siempre ISO 8601 (`YYYY-MM-DD`).
- Campos vacíos como `""`, nunca `None` o `null`.
- Si `paperless_doc_id` existe, incluir la URL completa al documento.
- El endpoint requiere `get_current_user` — nunca exponer sin auth.

### Frontend Web — botón de descarga

```typescript
// hooks/useExportCsv.ts
export function useExportCsv() {
  const [isExporting, setIsExporting] = useState(false)

  const exportCsv = async (tripId: string, options?: {
    from?: string
    to?: string
  }) => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({ format: "csv", ...options })
      const response = await fetch(
        `/api/reports/export/${tripId}?${params}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      )
      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")

      // Leer filename del header si existe
      const disposition = response.headers.get("Content-Disposition")
      const match = disposition?.match(/filename="(.+)"/)
      a.download = match?.[1] ?? "ledger-export.csv"
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  return { exportCsv, isExporting }
}
```

```tsx
// Componente botón — alineado con el design system Ledger
<button
  onClick={() => exportCsv(tripId)}
  disabled={isExporting}
  className="flex items-center gap-2 px-5 py-2.5 
             bg-surface-container-lowest rounded-full 
             border border-outline-variant/15 
             text-on-surface-variant font-label text-sm 
             hover:bg-surface-container-low transition-colors
             disabled:opacity-50"
>
  <span className="material-symbols-outlined text-sm">download</span>
  {isExporting ? "Exportando..." : "Exportar CSV"}
</button>
```

### Android — share CSV

En Android no se descarga a un directorio arbitrario: se genera el CSV en caché y se abre el share sheet del sistema.

```kotlin
// En ReportsViewModel
fun exportAndShareCsv(tripId: String, context: Context) {
    viewModelScope.launch {
        _uiState.value = ReportsUiState.Exporting
        try {
            val bytes = exportRepository.downloadCsv(tripId)  // llama al backend
            val file = File(context.cacheDir, "ledger_export.csv")
            file.writeBytes(bytes)

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/csv"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "Compartir gastos"))
            _uiState.value = ReportsUiState.Success
        } catch (e: Exception) {
            _uiState.value = ReportsUiState.Error(e.message ?: "Error al exportar")
        }
    }
}
```

**FileProvider** debe estar declarado en `AndroidManifest.xml` y con su `file_paths.xml` apuntando a `cache-path`.

---

## 🐳 Docker & DevOps

- Multi-stage builds en cada Dockerfile.
- Secrets nunca en código. `.env` gitignoreado, `.env.example` documentado.
- Healthchecks en todos los servicios.

---

## 🔒 Seguridad

- Passwords: **bcrypt** siempre.
- JWT: access 30min, refresh 7d en cookie HttpOnly (web) / DataStore cifrado (Android).
- CORS: orígenes explícitos, nunca `*` en producción.
- Uploads: validar MIME type en servidor (no confiar en extensión).
- Android: `network_security_config.xml` para no permitir cleartext en producción.

```python
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

async def validate_upload(file: UploadFile):
    content = await file.read(2048)
    await file.seek(0)
    mime = magic.from_buffer(content, mime=True)
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, "Tipo de archivo no permitido")
```

---

## 📝 Git & Commits

Conventional Commits en inglés:
- `feat(android):` nueva funcionalidad Android
- `feat(web):` nueva funcionalidad web
- `feat(api):` nuevo endpoint backend
- `fix:` corrección de bug
- `refactor:` sin cambio funcional
- `test:` tests
- `docs:` documentación

```bash
# ✅
feat(android): add CameraX scanner screen with ML Kit OCR
feat(api): add sync push/pull endpoints with idempotency
fix(android): fix JWT refresh race condition in AuthInterceptor

# ❌
fixed stuff / update / wip
```

**Nunca commitear:** `.env`, `local.properties`, `google-services.json`, API keys, `node_modules/`, `__pycache__/`, `.gradle/`, `build/`.

---

## 🔄 Workflow del Agente

1. Leer `MEMORY.md` para conocer el estado actual.
2. Leer `CLAUDE.md` si hay dudas de arquitectura.
3. Consultar esta guía antes de crear un archivo nuevo.
4. Implementar la tarea.
5. Escribir tests (unitarios mínimo).
6. Actualizar `MEMORY.md`: mover de Pendiente a Completado.
7. Commit con mensaje descriptivo.
