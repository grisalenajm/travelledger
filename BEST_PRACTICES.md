# BEST_PRACTICES.md — Ledger

> Normas obligatorias para todos los agentes. Leer antes de tocar cualquier fichero.

---

## 🚨 Reglas Críticas de Deploy

### Verificar que el código está en el contenedor
Un `docker compose up --build` con exit code 0 **no garantiza** que el código nuevo esté dentro.
Siempre verificar después de cada build:

```bash
docker compose exec backend grep -n "FUNCION_O_VARIABLE_NUEVA" /app/app/services/archivo.py
```

Si no aparece → el build usó caché o el commit no llegó. Investigar antes de seguir.

### Secuencia de deploy obligatoria
```bash
# 1. Commit y push
git add -A
git commit -m "tipo(scope): descripción"
git push origin main

# 2. En el LXC
ssh -i ~/.ssh/id_ed25519 root@192.168.1.125 \
  "cd /opt/ledger && git pull origin main && docker compose up -d --build [servicio]"

# 3. Verificar que el código nuevo está dentro
docker compose exec [servicio] grep -n "ALGO_DEL_CODIGO_NUEVO" /app/ruta/archivo.py

# 4. Verificar logs
docker compose logs [servicio] --since=1m
```

---

## 🐍 Backend — FastAPI

### Trailing slash y 307 redirects
**NUNCA** usar `""` en decoradores de colección. Siempre usar `"/"`:

```python
# ✅
@router.get("/")
# ❌
@router.get("")
```

### Lógica solo en services
Los routers son thin wrappers. Nunca lógica de negocio en routers:

```python
# ✅ router
@router.post("/", response_model=TripRead)
async def create_trip(data: TripCreate, current_user=Depends(get_current_user), db=Depends(get_db)):
    return await trip_service.create(db, current_user.id, data)

# ❌ router con lógica
@router.post("/")
async def create_trip(...):
    if data.end_date < data.start_date:  # esto va en el service
        raise HTTPException(...)
```

### FormData vs JSON
`POST /api/expenses` usa `Form(...)` — el cliente **debe** enviar `FormData`, nunca `application/json`:

```python
# ✅ backend
@router.post("/")
async def create_expense(
    trip_id: UUID = Form(...),
    amount: Decimal = Form(...),
    image: UploadFile | None = File(None),
    ...
):
```

```typescript
// ✅ frontend — usar FormData
const fd = new FormData()
fd.append("trip_id", tripId)
fd.append("amount", String(amount))
if (image) fd.append("image", image)
await api.postForm("/api/proxy/expenses/", fd)

// ❌ frontend — NO usar JSON para este endpoint
await api.post("/api/proxy/expenses/", { trip_id: tripId, amount })
```

### Nunca escribir a disco salvo volumen temporal
- OCR, CSV, ZIP → usar `io.BytesIO` / `io.StringIO`
- Imágenes de usuario sin Paperless → guardar en `/app/uploads/` (volumen Docker montado)
- Nunca en `/tmp/`, nunca en el filesystem del contenedor fuera del volumen

```python
# ✅
buffer = io.BytesIO()
zipf = zipfile.ZipFile(buffer, "w")
# ... añadir archivos ...
zipf.close()
buffer.seek(0)
return StreamingResponse(buffer, media_type="application/zip")

# ❌
with open("/tmp/export.zip", "wb") as f:
    ...
```

### Cifrado de claves sensibles en user_settings

```python
# core/crypto_utils.py
import base64
from cryptography.fernet import Fernet
from app.core.config import settings

def _get_fernet() -> Fernet:
    # Derivar clave de 32 bytes de SECRET_KEY
    key = base64.urlsafe_b64encode(settings.SECRET_KEY[:32].encode().ljust(32)[:32])
    return Fernet(key)

def encrypt(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()

def decrypt(value: str) -> str:
    return _get_fernet().decrypt(value.encode()).decode()
```

```python
# settings_service.py
ENCRYPTED_KEYS = {"anthropic_api_key", "paperless_token"}

async def set_setting(db, user_id, key: str, value: str | None):
    if value and key in ENCRYPTED_KEYS:
        value = encrypt(value)
    # ... upsert en BD

async def get_setting(db, user_id, key: str) -> str | None:
    raw = # ... leer de BD
    if raw and key in ENCRYPTED_KEYS:
        return decrypt(raw)
    return raw
```

**Regla:** NUNCA devolver claves reales en respuestas API. Solo `*_set: bool`:

```python
# ✅ schema response
class SettingsRead(BaseModel):
    paperless_url: str | None
    paperless_enabled: bool
    paperless_token_set: bool      # bool, nunca el token
    anthropic_api_key_set: bool    # bool, nunca la key

# ❌
class SettingsRead(BaseModel):
    anthropic_api_key: str | None  # NUNCA
```

### Fallback de configuración (user → entorno)

```python
# ocr_service.py
async def get_api_key(db, user_id: UUID) -> str:
    user_key = await settings_service.get_setting(db, user_id, "anthropic_api_key")
    return user_key or settings.ANTHROPIC_API_KEY

# paperless_service.py
async def get_credentials(db, user_id: UUID) -> tuple[str, str]:
    url = await settings_service.get_setting(db, user_id, "paperless_url") or settings.PAPERLESS_URL
    token = await settings_service.get_setting(db, user_id, "paperless_token") or settings.PAPERLESS_TOKEN
    return url, token
```

### Migración async a Paperless

```python
# settings_service.py
async def migrate_to_paperless(db: AsyncSession, user_id: UUID):
    """Migra imágenes del volumen local a Paperless cuando el usuario lo configura."""
    expenses = await expense_service.get_with_local_path(db, user_id)
    for expense in expenses:
        try:
            url, token = await paperless_service.get_credentials(db, user_id)
            doc_id = await paperless_service.upload(url, token, expense.local_path)
            await expense_service.update_paperless_doc(db, expense.id, doc_id)
            Path(expense.local_path).unlink(missing_ok=True)
        except Exception as e:
            logger.error(f"migrate_to_paperless: expense {expense.id} falló: {e}")
            continue  # nunca bloquear
```

```python
# router settings
@router.put("/")
async def update_setting(data: SettingUpdate, background_tasks: BackgroundTasks, ...):
    await settings_service.set_setting(db, current_user.id, data.key, data.value)
    if data.key in ("paperless_url", "paperless_token"):
        background_tasks.add_task(migrate_to_paperless, db, current_user.id)
    return await settings_service.get_all(db, current_user.id)
```

### Registro self-hosted

```python
# auth_service.py
async def register(db, data: UserCreate) -> User:
    has_users = await user_exists_any(db)
    
    if has_users:
        if not settings.ALLOW_REGISTRATION:
            raise HTTPException(403, "El registro está cerrado")
    
    user = User(
        ...
        is_admin=not has_users,  # primer usuario → admin
    )
    db.add(user)
    await db.commit()
    return user
```

---

## 🌐 Frontend — Next.js 14

### Proxy obligatorio
Las llamadas al backend van **siempre** por `/api/proxy/*`. Nunca llamar directamente al backend desde el navegador:

```typescript
// ✅
const data = await api.get("/api/proxy/trips/")

// ❌
const data = await fetch("http://backend:8000/api/trips/")
```

### useSearchParams — Suspense obligatorio

En Next.js 14, `useSearchParams()` **fuera** de `<Suspense>` causa error de build en producción:

```tsx
// ✅ patrón correcto
function PageContent() {
  const searchParams = useSearchParams()
  return <div>...</div>
}

export default function Page() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <PageContent />
    </Suspense>
  )
}
```

### FormData para endpoints con imagen

```typescript
// lib/api.ts — método postForm
async postForm(path: string, formData: FormData) {
  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}` },
    body: formData,
    // NO añadir Content-Type — el navegador lo pone con boundary automáticamente
  })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}
```

### Dark mode con next-themes

```tsx
// app/layout.tsx
import { ThemeProvider } from "next-themes"

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

```tsx
// components/theme-toggle.tsx
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // "system" | "light" | "dark"
}
```

### i18n con next-intl (sin prefijo de ruta)

```typescript
// i18n.ts
import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

export default getRequestConfig(async () => {
  const locale = cookies().get("NEXT_LOCALE")?.value ?? "es"
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})
```

```tsx
// Server Component
import { getTranslations } from "next-intl/server"

export default async function TripsPage() {
  const t = await getTranslations("trips")
  return <h1>{t("title")}</h1>
}

// Client Component
import { useTranslations } from "next-intl"

export function TripCard() {
  const t = useTranslations("trips")
  return <span>{t("status.active")}</span>
}
```

**Estructura de mensajes:**
```json
// messages/es.json
{
  "nav": { "trips": "Viajes", "settings": "Configuración" },
  "trips": {
    "title": "Mis viajes",
    "status": { "active": "Activo", "closed": "Cerrado", "draft": "Borrador" }
  },
  "expenses": { "title": "Gastos", "billable": "Facturable" },
  "settings": {
    "profile": "Perfil",
    "ocr": "OCR",
    "paperless": "Paperless",
    "appearance": "Apariencia"
  },
  "auth": {
    "register": { "closed": "El registro está cerrado. Contacta con el administrador." }
  }
}
```

### Descarga de archivos (CSV/ZIP)

```typescript
// hooks/use-export.ts
export function useExportTrip(tripId: string) {
  const downloadFile = async (url: string, filename: string) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = filename
    a.click()
    URL.revokeObjectURL(href)
  }

  return {
    downloadCsv: (onlyBillable: boolean) =>
      downloadFile(
        `/api/proxy/reports/export/${tripId}?format=csv&only_billable=${onlyBillable}`,
        `gastos_${tripId}.csv`
      ),
    downloadBundle: (onlyBillable: boolean) =>
      downloadFile(
        `/api/proxy/reports/export/${tripId}/bundle?only_billable=${onlyBillable}`,
        `bundle_${tripId}.zip`
      ),
  }
}
```

---

## 📝 Git

```bash
# Formato obligatorio de commits
feat(web): descripción
feat(api): descripción
fix(proxy): descripción
fix(backend): descripción
refactor(auth): descripción
docs: descripción
chore(deps): descripción

# Rama siempre main
git branch -M main
```

**Nunca commitear:** `.env`, API keys, `node_modules/`, `__pycache__/`, `*.pyc`

---

## 🔒 Seguridad

- Passwords: bcrypt siempre
- JWT: access 30min, refresh 7d
- API keys en BD: Fernet cifrado, derivado de `SECRET_KEY`
- CORS: orígenes explícitos en `ALLOWED_ORIGINS`, nunca `*` en prod
- Uploads: validar MIME por magic bytes, no por extensión
- `ANTHROPIC_API_KEY`: solo en backend, nunca en frontend
- Settings API: devolver siempre `*_set: bool`, nunca la clave real
- `pin bcrypt>=4.0,<5.0` — bcrypt 5.x rompe passlib

---

## 🐛 Bugs conocidos y soluciones documentadas

| Bug | Solución |
|-----|----------|
| `passlib` incompatible con `bcrypt>=5` | Pin `bcrypt>=4.0,<5.0` en requirements.txt |
| Next.js 14 no soporta `next.config.ts` | Usar `next.config.mjs` |
| Next.js standalone: healthcheck falla | `ENV HOSTNAME=0.0.0.0` en Dockerfile |
| BuildKit LXC no hereda DNS (Tailscale) | `{"dns":["8.8.8.8","1.1.1.1"]}` en `/etc/docker/daemon.json` |
| `NEXT_PUBLIC_API_URL` embebida en build | Proxy `/api/proxy/*` con `API_INTERNAL_URL` |
| `useSearchParams` sin Suspense → error build prod | Envolver en `<Suspense>` |
| `POST /api/expenses` espera FormData, no JSON | Usar `api.postForm()` con FormData |
| Backend unhealthy tras reinicio NAS | Esperar a postgres-ledger, luego `docker compose restart backend` |
