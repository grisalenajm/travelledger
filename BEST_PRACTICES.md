# BEST_PRACTICES.md — Ledger

> Normas obligatorias para todos los agentes.
> Leer antes de tocar cualquier fichero.

---

## 🚨 Reglas Críticas de Deploy

### Inicio de sesión Claude Code
Ejecutar siempre `/clear` al inicio de cada sesión para minimizar consumo de tokens.

### Secuencia obligatoria

```bash
git add -A && git commit -m "tipo(scope): desc" && git push origin main
ssh root@YOUR_SERVER "cd /opt/ledger && git pull origin main && docker compose up -d --build [servicio]"
docker compose exec backend alembic upgrade head  # si hay migrations
docker compose exec [servicio] grep -n "CODIGO_NUEVO" /app/ruta/archivo.py
docker compose logs [servicio] --since=1m
```

### Verificar trailing slashes tras deploy backend

```bash
docker compose exec backend python -c "
from app.main import app
for r in app.routes:
    if hasattr(r, 'path') and r.path.endswith('/') and r.path != '/':
        print('TRAILING SLASH:', r.methods, r.path)
"
# No debe aparecer ninguna línea
```

### Regla de oro para migrations

**SOLO `ALTER TABLE ADD COLUMN` — nunca DROP, nunca recrear tablas.**
Los 3 viajes con expenses en producción NO se pueden perder.

---

## 🐍 Backend — FastAPI

### Trailing slash — NUNCA en endpoints

```python
# ✅ sin trailing slash
@router.get("/{trip_id}/legs")
@router.get("/{trip_id}/stats")
@router.get("/global")

# ❌ Next.js lo elimina → 404
@router.get("/{trip_id}/legs/")
```

### APIRouter prefix — NUNCA path parameters

```python
# ✅
router = APIRouter(prefix="/api/trips", tags=["legs"])
@router.get("/{trip_id}/legs")

# ❌
router = APIRouter(prefix="/api/trips/{trip_id}/legs")
```

### Campos opcionales desde formularios HTML — SIEMPRE field_validator

Los formularios HTML envían `""` para campos no rellenados.
Pydantic NO convierte `""` a `None` automáticamente.
**TODOS los campos opcionales de tipo no-string necesitan validator.**

```python
# ✅ patrón completo para TripLeg y similares
from pydantic import field_validator
from decimal import Decimal
from datetime import datetime
from uuid import UUID

class TripLegBase(BaseModel):
    # UUID opcionales
    expense_id: UUID | None = None
    loyalty_card_id: UUID | None = None
    
    # Datetime opcionales
    departure_local: datetime | None = None
    arrival_local: datetime | None = None
    check_in: datetime | None = None
    check_out: datetime | None = None
    pickup_datetime: datetime | None = None
    dropoff_datetime: datetime | None = None
    
    # Decimal/float opcionales
    distance_km: Decimal | None = None
    location_lat: float | None = None
    location_lng: float | None = None

    @field_validator('expense_id', 'loyalty_card_id', mode='before')
    @classmethod
    def empty_str_uuid_to_none(cls, v):
        if v == '' or v == 'null' or v is None:
            return None
        return v

    @field_validator('departure_local', 'arrival_local', 'check_in', 'check_out',
                     'pickup_datetime', 'dropoff_datetime', mode='before')
    @classmethod
    def empty_str_datetime_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v

    @field_validator('distance_km', 'location_lat', 'location_lng', mode='before')
    @classmethod
    def empty_str_decimal_to_none(cls, v):
        if v == '' or v is None:
            return None
        return v
```

### EXIF GPS con Pillow

Usar siempre `getexif().get_ifd(0x8825)` — `_getexif()` es privado y devuelve IFDRational en Android que no convierte a float correctamente.

```python
import io
from PIL import Image

def extract_exif_gps(content: bytes) -> tuple[float, float] | None:
    try:
        img = Image.open(io.BytesIO(content))
        exif_data = img.getexif()
        if not exif_data:
            return None
        gps_ifd = exif_data.get_ifd(0x8825)
        if not gps_ifd:
            return None

        # GPS tag IDs: 1=LatRef, 2=Lat, 3=LngRef, 4=Lng
        lat_vals = gps_ifd.get(2)
        lat_ref = gps_ifd.get(1)
        lng_vals = gps_ifd.get(4)
        lng_ref = gps_ifd.get(3)

        if not all([lat_vals, lat_ref, lng_vals, lng_ref]):
            return None

        def to_decimal(dms, ref: str) -> float:
            d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
            result = d + m / 60 + s / 3600
            return round(-result if ref in ("S", "W") else result, 6)

        lat = to_decimal(lat_vals, lat_ref)
        lng = to_decimal(lng_vals, lng_ref)
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return None
        return lat, lng
    except Exception:
        return None
```

### Haversine — fórmula correcta

```python
import math

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371  # km
    lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
    return round(2 * R * math.asin(math.sqrt(a)), 1)
# MAD→BCN = 483.2 km ✅
```

### Geocodificación — prioridad de fuentes

1. EXIF GPS de la foto → coords directas
2. Código IATA → coords del CSV (airport_service)
3. Haiku extrae location_name → Nominatim en BackgroundTask
4. Campo manual location_name → Nominatim en BackgroundTask
5. Fallo → guardar sin coords, no bloquear

### BackgroundTasks — nunca bloquear response

```python
@router.post("/{trip_id}/legs")
async def create_leg(background_tasks: BackgroundTasks, ...):
    leg = await leg_service.create(db, trip_id, user.id, data)
    background_tasks.add_task(geocoding_service.geocode_leg, db, leg.id)
    return leg
```

### Refresh tras commit — OBLIGATORIO

```python
await db.commit()
await db.refresh(obj)
return obj
```

---

## 🌐 Frontend — Next.js 14

### Proxy — sin trailing slash

```typescript
// ✅
api.get(`/api/proxy/trips/${tripId}/legs`)
api.get(`/api/proxy/trips/${tripId}/map-data`)
api.get(`/api/proxy/airports/search?q=${q}`)

// ❌
api.get(`/api/proxy/trips/${tripId}/legs/`)
```

### Limpiar payload antes de enviar

```typescript
// ✅ eliminar strings vacíos y undefined antes de POST/PUT
const cleanPayload = Object.fromEntries(
  Object.entries(payload).filter(([_, v]) => v !== '' && v !== undefined)
)
await api.post(`/api/proxy/trips/${tripId}/legs`, cleanPayload)
```

### Leaflet — obligatorio

```typescript
// ✅ importar dinámicamente (SSR falla con Leaflet)
const TripMap = dynamic(() => import("@/components/trip-map"), { ssr: false })

// ✅ en el componente del mapa
import "leaflet/dist/leaflet.css"
import L from "leaflet"
// Configurar iconos self-contained (sin CDN)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })
```

### UUID opcionales en formularios

```typescript
// ✅
const payload = {
  ...formData,
  expense_id: formData.expense_id || null,
  loyalty_card_id: formData.loyalty_card_id || null,
}
```

### TypeScript strict con cast

```typescript
// ✅ cuando el tipo origen es Record<string, unknown>
await api.post(url, cleanPayload as unknown as TripLegCreate)
```

### Recharts

```tsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart isAnimationActive={false}>
```

---

## 📝 Git

```bash
feat(api)|feat(web)|fix(api)|fix(web)|refactor|docs|chore
# Rama siempre main
# Nunca: .env, uploads/, __pycache__/, node_modules/
```

---

## ✅ Checklist deploy

- [ ] Sin trailing slash en ningún endpoint nuevo
- [ ] field_validator para TODOS los campos opcionales no-string
- [ ] Payload limpiado en frontend antes de enviar
- [ ] Migration solo `ALTER TABLE ADD COLUMN`
- [ ] `alembic upgrade head` aplicado
- [ ] Variables nuevas en `docker-compose.yml environment:`
- [ ] Verificar trailing slashes con script python
- [ ] Grep verifica código en contenedor
- [ ] Logs sin errores
- [ ] Smoke test en producción
- [ ] `MEMORY.md` y `TODO.md` actualizados

---

## 📦 Frontend — Optimización de imágenes

### sharp (Next.js Image Optimization)

`sharp` es obligatorio en el Dockerfile del frontend para optimización de imágenes en producción.
Sin él, Next.js muestra un warning y usa un fallback más lento.

```dockerfile
RUN npm ci
RUN npm i sharp
```

- No añadir a `package.json` — solo en Dockerfile (evita problemas en entornos dev sin binarios nativos)
- Beneficio: convierte automáticamente fotos de portada a WebP, reduce KB enviados al navegador
- Sin impacto en RAM en reposo — solo se activa al procesar imágenes
- Compatible con x86/amd64 (LXC Proxmox). En ARM verificar compatibilidad antes de añadir.

---

## 🔐 Autenticación — Reglas anti-bucle en móvil

### Componentes con useSession en el layout

Todo componente que use `useSession()`, `useRole()`, `useIsGuest()` en el layout
**DEBE** tener guard de loading:

```typescript
if (status === 'loading') return null
if (!session) return null
```

Sin este guard, en móvil por HTTP el componente entra en bucle de re-renders.

### Fallback de rol

**NUNCA** usar `'guest'` como fallback — siempre `'user'`:

```typescript
return (session?.user?.role as UserRole) ?? 'user'   // ✅
return (session?.user?.role as UserRole) ?? 'guest'  // ❌ causa bucle
```

### Hooks que hacen fetch

Todo hook con `useQuery` que requiere auth **DEBE** tener `enabled: !!session`:

```typescript
enabled: !!session  // ✅ no fetch sin sesión activa
```

### Claves de configuración email

Las claves SMTP/IMAP se guardan en tabla `settings` con prefijo `mail_*`:

```
mail_host, mail_imap_port, mail_smtp_port, mail_user, mail_password,
mail_imap_folder, mail_sender_filter, mail_smtp_from
```

**NUNCA** usar variables de entorno `SMTP_*` — leer siempre de la BD.

---

## 🔍 OCR providers — arquitectura LlmOcrProvider

### Interfaz y factory

El sistema OCR usa el patrón factory + adaptador (`services/ocr_providers/`):

```
ocr_factory.get_ocr_provider(db, user_id)
  → ClaudeHaikuAdapter   # claude   (default)
  → OpenAiAdapter        # openai
  → OllamaAdapter        # ollama
  → GeminiAdapter        # gemini
```

Cada adaptador implementa `LlmOcrProvider`:
- `async def extract(image_bytes, mime_type) -> OcrResult` — facturas
- `async def extract_boarding_pass(image_bytes, mime_type) -> BoardingPassResult` — boarding passes

### Configuración por usuario (user_settings)

| key | descripción | cifrado |
|-----|-------------|---------|
| `ocr_provider` | "claude" / "openai" / "ollama" / "gemini" | No |
| `anthropic_api_key` | API key Anthropic | **Sí** |
| `openai_api_key` | API key OpenAI | **Sí** |
| `gemini_api_key` | API key Google AI Studio | **Sí** |
| `ollama_url` | URL Ollama (default http://localhost:11434) | No |
| `ollama_model` | Modelo visión (default llama3.2-vision) | No |

### Limitaciones conocidas por motor

| Motor | PDF | Notas |
|-------|-----|-------|
| Claude Haiku 4.5 | ✅ (beta pdfs-2024-09-25) | Default. Prompt caching ephemeral. |
| GPT-4o mini | ❌ | Devuelve OcrResult vacío para PDFs. |
| Ollama | ❌ | Devuelve resultado vacío para PDFs. Timeout 120s. |
| Gemini Flash 1.5 | ✅ | SDK google-generativeai. Ejecuta sync en thread pool. |

### Ollama con AMD ROCm (MSI Vector 16HX / RX 7700S RDNA3)

La tarjeta RX 7700S usa arquitectura RDNA3 (gfx1102). Ollama necesita soporte ROCm para aceleración GPU en AMD:

**Opción A — Imagen Docker con ROCm (recomendada para homelab):**
```bash
docker run -d --device /dev/kfd --device /dev/dri \
  --group-add video --group-add render \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama:rocm
```
Verificar soporte: `ollama run llava "describe this" --verbose` — debe mostrar GPU en logs.

**Opción B — CPU (sin ROCm, más lento pero siempre funciona):**
```bash
ollama pull llama3.2-vision
ollama run llama3.2-vision
```
En CPU un modelo 11B tarda ~30-90s por imagen. El timeout del adaptador es 120s.

**Opción C — Compilación manual con ROCm:**
Requiere ROCm 6.x instalado. Seguir guía oficial: https://github.com/ollama/ollama/blob/main/docs/gpu.md

**Modelos de visión probados:**
- `llama3.2-vision` — 11B, buen balance calidad/velocidad
- `minicpm-v` — más ligero, menor calidad OCR
- `llava:13b` — más preciso, requiere 16GB+ VRAM

---

## 🐛 Fixes documentados

| Fix | Descripción |
|-----|-------------|
| Fix 1-8 | Infraestructura: sync, proxy, URL, bcrypt, next.config, HOSTNAME, DNS, NEXT_PUBLIC |
| Fix 9-16 | App: Suspense, FormData, db.refresh, env vars, uploads, toggle, Paperless redirects |
| Fix 17-22 | Paperless: duplicados, timeout, título, viaje activo, StatusChip, alembic |
| Fix 23 | Legs router: `{trip_id}` en prefix APIRouter no válido |
| Fix 24 | Next.js elimina trailing slash — endpoints sin trailing slash |
| Fix 25 | UUID opcionales desde select → field_validator + `\|\| null` frontend |
| Fix 26 | Trailing slash en stats endpoints |
| Fix 27 | Mapa: iconos Leaflet self-contained con webpack config |
| Fix 28 | Haversine: `_maybe_compute_distance` no se llamaba tras geocode_leg_bg |
| Fix 29 | IATA search: `break` prematuro — sort tras iteración completa |
| Fix 30 | 422 en legs: datetime y Decimal vacíos → field_validator empty_str_to_none |
| Fix 31 | APScheduler no es multi-process safe — Dockerfile CMD debe usar `--workers 1` |
| Fix 32 | Contenedor Docker no resuelve hostnames LAN — usar `extra_hosts` en docker-compose.yml |
| Fix 33 | `db.flush()` en `leg_service.update` causaba deadlock con `geocode_leg_bg` — reemplazar por `db.commit()` |
| Fix 34 | Fallback de rol `'guest'` → `'user'` — `'guest'` como fallback causaba bucle de re-renders en móvil |
| Fix 35 | Guard `status==='loading'` en componentes con `useSession` en layout — sin guard entra en bucle en móvil por HTTP |
| Fix 36 | Claves `imap_*` renombradas a `mail_*` en BD y frontend — unificación SMTP/IMAP bajo prefijo común |
| Fix 37 | Botones de formulario tapados por bottom nav en móvil → footers fijos: `bottom-[64px] md:bottom-0 z-[45]` + form `pb-44 md:pb-28`; páginas con botones inline: `sticky bottom-20 md:static` + form `pb-24 md:pb-0` |
| Fix 38 | `payment_method_id` y `loyalty_card_id` UUID opcionales en `ExpenseCreate`/`ExpenseUpdate` sin `field_validator` → 422 si el cliente envía `""`. Fix: añadir `empty_str_uuid_to_none` validator en ambas clases. Frontend: usar `\|\| null` en todos los campos UUID opcionales del payload antes del PUT/POST. |
| Fix 39 | `db.flush()` en `expense_service.create` y `expense_service.update` causaba deadlock con `geocode_expense_bg` — la tarea de fondo abría su propia sesión e intentaba leer el registro antes de que el flush se consolidara. Reemplazar por `db.commit()` (líneas 177 y 216); `db.refresh(expense)` después de cada commit ya existía. Patrón idéntico al Fix 33 de `leg_service`. |
| Fix 40 | `location_lat/lng` en schema Zod del formulario de gasto usaban `z.number().optional().nullable()` — Zod rechaza `undefined` transitorio que aparece entre el `defaultValues` inicial y el `reset()` de datos reales, bloqueando silenciosamente el submit si el gasto no tenía coords. Fix: `z.union([z.number(), z.null(), z.undefined()]).optional()` en ambos campos. Patrón a aplicar en cualquier campo numérico opcional que se inicialice con `null` y pueda pasar por `undefined`. |
| Fix 41 | Scan desde inicio sin `tripId` en URL → confirm page mostraba "Parámetros incorrectos" sin recovery. Fix: añadir selector de viaje en confirm si `tripIdParam` vacío; `GET /api/trips/active` + `useActiveTrip()` para resolución server-side. |
| Fix 42 | Localización no propuesta al confirmar gasto OCR. Fix: pipeline EXIF GPS → OCR merchant → Nominatim BackgroundTask en `receipts.py`; `OcrResult` añade `location_lat/lng/name`; confirm page muestra badge + campo editable + lo envía en el PUT. `_extract_exif_gps` renombrado a `extract_exif_gps` (función pública reutilizada desde receipts.py). |
| Fix 43 | Parser de emails de viaje generalizado → `travel_email_parser.py`. Arquitectura dos fases: clasificación por keywords (ES/EN/FR) → extracción específica por tipo (flight/hotel/car_rental/train). ICS tiene prioridad sobre texto plano. Retorna `TravelParseResult` (único leg); `parse_travel_email_text()` para callers con texto ya extraído (webhook + IMAP). Notificaciones tipo `email_import` / `email_imap`. `IMAP_SENDER_FILTER` vacío = aceptar todos los remitentes. |
| Fix 44 | (ver TODO.md) |
| Fix 45 | `extract_exif_gps` reescrita con `getexif().get_ifd(0x8825)` + check explícito `if not all([lat_vals, lat_ref, lng_vals, lng_ref])` — evita IFDRational de Android y retorna None limpio si falta cualquier tag GPS. Frontend: `exifr` extrae GPS antes del upload y lo envía como `exif_lat/exif_lng` en el FormData; backend lo usa directamente sin releer los bytes EXIF. |
| Fix 46 | Location dropdown recortado: `PopoverContent` con width `min(520px,90vw)` + ítem de dos líneas (name bold + dirección en gris `line-clamp-2`). Endpoint `GET /api/geocoding/search` devuelve `name` (corto) + `display_name` (completo) separados — nunca un solo campo truncado. `PlaceResult.lng` mantiene el nombre `lng` (no `lon`) para compatibilidad con todos los callers. |
| Fix 47 | Markers Leaflet arrastrables: `L.circleMarker` no soporta drag → reemplazar por `L.marker` con `L.divIcon` circular. Handler `dragend`: reverse geocode silencioso → PUT expense → `toast.success`. `UnlocatedExpensesPanel`: panel lateral que separa gastos con/sin coords en estado local del padre — no requiere recarga. En móvil: badge colapsable en toggles. Estado local `localExpenses` synced con `useEffect` desde `mapData.expenses`; `useCallback` en el update handler para evitar redraws innecesarios del mapa. |
| Fix 48 | Payment method delete silencioso: `mutateAsync` lanzaba excepción no capturada al recibir 409. Fix: `try/catch` alrededor de `remove.mutateAsync`, estado `deleteError` muestra el mensaje del backend. El backend ya tenía la comprobación de FK correcta. |
| Fix 49 | Boarding pass PDF falla con Claude Haiku: `beta.messages.create(betas=["pdfs-2024-09-25"])` + `cache_control` en system provoca conflicto. Fix: usar `messages.create(extra_headers={"anthropic-beta": "pdfs-2024-09-25"})` — la API estándar gestiona `cache_control` nativamente; el header PDF se inyecta vía `extra_headers`. |
| Fix 50 | IMAP trata boarding passes como receipts. Fix: `_process_attachment()` intenta `extract_boarding_pass()` primero; si tiene `flight_number` busca leg coincidente por número normalizado (uppercase sin espacios); si encuentra → vincula documento; si no → crea leg `mode=flight`; sólo si no es boarding pass → crea expense. |
| Fix 51 | Airport lookup devuelve "nombre raro": `search()` hacía partial match sin normalización. Fix: `get_by_iata()` búsqueda exacta, `search_by_name()` con `_normalize()` (unicodedata NFD, lowercase). `travel_email_parser._resolve_to_iata()` prioriza código IATA entre paréntesis "Ciudad (XRY)" → "XRY", luego búsqueda por nombre. `leg_service._apply_iata_coords()` añade `search_by_name` como fallback cuando `get_coords` falla. |
| Fix 52 | Boarding pass OCR devuelve basura (OUT→AND, mode=PASSES, aerolínea desconocida): el prompt no instruía al modelo a inferir códigos IATA de nombres de aeropuerto. Fix: prompt completo en inglés con ejemplos explícitos nombre→IATA (CVG, LHR, MAD, XRY…) y mapeo carrier→código (BA, IB, FR…). JSON devuelve `origin_iata`/`destination_iata`/`carrier_name`/`carrier_iata` + `departure_date`/`departure_time` separados. Parser reconstruye `departure_local` como naive datetime local (sin conversión UTC). `BoardingPassResult` añade `carrier_iata`. `_create_leg_from_boarding_pass` en email_processor usa `origin_iata`/`destination_iata` directamente. `mode` siempre hardcodeado a `"flight"` — nunca del OCR. Deduplicación por `flight_number+departure_date` dentro del mismo email. Frontend `leg-card`: fallback `resolveCarrierDisplay` extrae IATA del `flight_number` cuando `leg.carrier` es null. |
| Fix 53 | Trip destination text field → `LocationAutocomplete` (Nominatim, Fix 46). Nuevos campos `destination_lat`/`destination_lng` en tabla `trips` (migration 0021 ADD COLUMN Numeric 9,6). `TripCreate`/`TripUpdate` schemas: `destination_lat/lng` opcionales + `empty_str_float_to_none` validator. `Trip` type frontend añade `destination_lat/lng: number\|null`. Zod: `z.union([z.number(), z.null(), z.undefined()]).optional()` (patrón Fix 40). `unsplash_service.fetch_and_save_cover(trip_id, destination)` extrae lógica a función reutilizable con su propia sesión (`AsyncSessionLocal`) para background tasks. `trip_service.create` delega a `fetch_and_save_cover`. `trip_service.update` acepta `background_tasks` opcional → auto-dispara portada cuando `destination` cambia. `POST /api/trips/{id}/cover/regenerate`: endpoint explícito sin trailing slash. Edit page: botón "Regenerar portada" inline bajo la imagen + `setTimeout(3000)` + `queryClient.invalidateQueries`. |
| Fix 56 | CSV europeo: separador `;` + decimal `,` + BOM UTF-8. `generate_csv()` y `generate_xlsx()` en `export_service.py` — ambas síncronas devuelven `bytes`. `_fmt_decimal_eu()` intercambia `.` y `,` para estilo europeo en CSV. XLSX con `openpyxl` en `BytesIO` — nunca a disco. Dos hojas: "Gastos" (datos con cabecera coloreada, freeze_panes) + "Resumen" (trip info + totales por moneda). Ambas hojas incluyen totales por moneda del gasto y total en moneda base. `ExportFormat` Enum (`csv`\|`xlsx`) como query param en `/export/{id}` y `/export/{id}/bundle`. Default `xlsx`. Bundle `build_bundle()` acepta `format` para elegir qué fichero de datos incluir en el ZIP. Frontend: dos botones toggle Excel/CSV + nota informativa sobre separadores cuando se selecciona CSV. |
| Fix 57 | Reasignar gasto: `PUT /api/expenses/{id}/reassign` — desvincula `leg.expense_id` del viaje origen (UPDATE TripLeg WHERE expense_id = X SET expense_id = NULL) antes de mover el gasto. Reasignar tramo: `PUT /api/trips/{tid}/legs/{lid}/reassign` — mueve leg y su gasto vinculado en cascade. Ambos endpoints reciben `{trip_id: UUID}`, validan que el destino pertenece al usuario, devuelven 422 si ya es del mismo viaje. Frontend: botón `swap_horiz` en footer de ExpenseDetail (oculto si no hay otros viajes) + botón flotante en cada LegCard de la página itinerario. Dialog nativo `<select>` sin dependencias extra. Banner amber cuando el gasto vinculado se moverá en cascade. Tras reasignar: `invalidateQueries(["expenses"])` + `invalidateQueries(["trips"])` + `router.back()` o `refetchLegs()`. |
