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

Si no aparece nada → el build usó caché o el commit no llegó. Investigar antes de seguir.

### Secuencia de deploy obligatoria
```bash
# 1. Commit y push
git add -A
git commit -m "tipo(scope): descripción"
git push origin main

# 2. En el LXC
ssh -i ~/.ssh/id_claude root@192.168.1.125 \
  "cd /opt/ledger && git pull origin main && docker compose up -d --build [servicio]"

# 3. Verificar que el código nuevo está dentro
docker compose exec [servicio] grep -n "ALGO_DEL_CODIGO_NUEVO" /app/ruta/archivo.py

# 4. Verificar logs
docker compose logs [servicio] --since=1m
```

### Nunca dar la tarea por terminada sin verificar el contenedor
Si el grep del paso 3 no devuelve resultados → el código no está desplegado → investigar.

---

## 🐍 Backend — FastAPI

### Trailing slash y 307 redirects
**NUNCA** usar `""` en decoradores de colección. Usar siempre `redirect_slashes=False` en el router:

```python
# ✅ CORRECTO
router = APIRouter(
    prefix="/api/expenses",
    tags=["expenses"],
    redirect_slashes=False,
)

@router.get("")      # coincide con /api/expenses
@router.post("")     # coincide con /api/expenses
@router.get("/{id}") # coincide con /api/expenses/123
```

```python
# ❌ INCORRECTO — genera 307 cuando el cliente llama sin slash
router = APIRouter(prefix="/api/expenses")
@router.get("/")   # FastAPI redirige /api/expenses → /api/expenses/
```

### Lógica solo en services
```python
# ✅ CORRECTO — router solo orquesta
@router.post("")
async def create_expense(data: ExpenseCreate, db=Depends(get_db), user=Depends(get_current_user)):
    return await expense_service.create(db, user_id=user.id, data=data)

# ❌ INCORRECTO — lógica en router
@router.post("")
async def create_expense(data: ExpenseCreate, db=Depends(get_db)):
    expense = Expense(**data.model_dump())
    db.add(expense)
    await db.commit()
```

### Logging obligatorio en operaciones externas
Siempre loggear antes de llamar a Paperless, Anthropic o servicios externos:
```python
logger.info("Paperless upload — title=%s correspondent_id=%s", title, correspondent_id)
```

### Multipart con httpx — campos mixtos
Cuando hay campos de texto y fichero en el mismo POST, usar `files=` con tuplas para todo:
```python
# ✅ CORRECTO — todo en files con tuplas (None, valor) para texto
multipart_fields = {
    "title": (None, title),
    "correspondent": (None, str(correspondent_id)),
    "document": (filename, file_bytes, mime_type),
}
resp = await client.post(url, headers=auth_header, files=multipart_fields)

# ❌ INCORRECTO — data= y files= juntos puede causar encoding incorrecto
resp = await client.post(url, data={"title": title}, files={"document": ...})
```

### Haiku OCR — limpiar markdown fences antes de json.loads()
Haiku puede devolver JSON envuelto en ` ```json ... ``` `. Limpiar siempre antes de parsear:
```python
cleaned = raw_text.strip()
if cleaned.startswith("```"):
    cleaned = cleaned.split("```")[1]
    if cleaned.startswith("json"):
        cleaned = cleaned[4:]
    cleaned = cleaned.strip()
data = json.loads(cleaned[cleaned.find("{"):cleaned.rfind("}") + 1])
```

### Pydantic v2 y date alias
```python
# ❌ En Python 3.12, 'date' como nombre de campo en clase SQLAlchemy hace shadowing
from datetime import date as date_t  # usar alias

class Expense(Base):
    date: Mapped[date_t]  # ✅
```

---

## ⚛️ Frontend — Next.js

### Proxy URL — sin trailing slash
El proxy construye la URL sin slash final. FastAPI tiene `redirect_slashes=False`:
```typescript
// ✅ CORRECTO
const joinedPath = pathSegments.join("/")  // "expenses" no "expenses/"
const url = `${API_INTERNAL_URL}/api/${joinedPath}${searchParams ? `?${searchParams}` : ""}`
```

### Proxy multipart — preservar Content-Type con boundary
```typescript
// ✅ CORRECTO
const incomingContentType = req.headers.get("content-type") || ""
const isMultipart = incomingContentType.startsWith("multipart/form-data")

const body = hasBody
  ? isMultipart ? await req.arrayBuffer() : await req.text()
  : undefined

if (isMultipart) {
  fetchHeaders["Content-Type"] = incomingContentType  // preservar con boundary
} else {
  fetchHeaders["Content-Type"] = "application/json"
}
```

### FormData en el cliente — nunca fijar Content-Type
```typescript
// ✅ CORRECTO — el browser añade el boundary automáticamente
const fd = new FormData()
fd.append("file", file)
await fetch("/api/proxy/expenses", { method: "POST", body: fd })

// ❌ INCORRECTO — faltaría el boundary
await fetch(url, {
  method: "POST",
  body: fd,
  headers: { "Content-Type": "multipart/form-data" }  // NO hacer esto
})
```

### Redirect en proxy
```typescript
// ✅ Seguir redirects por si acaso
const response = await fetch(url, {
  method,
  headers: fetchHeaders,
  body,
  redirect: "follow",
  // @ts-ignore
  duplex: "half",
})
```

### Decimales desde FastAPI
FastAPI devuelve `Decimal` como string en JSON. Siempre envolver con `Number()`:
```typescript
// ✅
const amount = Number(expense.amount).toFixed(2)

// ❌ — falla si amount es string
const amount = expense.amount.toFixed(2)
```

### SessionProvider — Navbar dentro de Providers
```tsx
// ✅ CORRECTO — Navbar es hijo de Providers (tiene acceso a useSession)
<Providers>
  <Navbar />
  {children}
</Providers>

// ❌ INCORRECTO — fuera del contexto
<Navbar />
<Providers>{children}</Providers>
```

---

## 🗄️ Paperless-ngx — Integración

### IDs conocidos en producción
| Entidad | Nombre | ID |
|---------|--------|----|
| Correspondent | Comida | 2 |
| Correspondent | Transporte | 1 |
| Correspondent | Alojamiento | 3 |
| Correspondent | otros | 11 |
| Document type | Invoice | 1 |
| Storage path | Viajes | 1 |
| Tag | travel | 5 |

### Query por nombre — usar name__iexact
```python
# ✅ CORRECTO — case insensitive
resp = await client.get(f"{base}/api/correspondents/", params={"name__iexact": name}, ...)

# ❌ INCORRECTO — case sensitive, puede no encontrar
resp = await client.get(f"{base}/api/correspondents/", params={"name": name}, ...)
```

### Mapeo categorías → correspondents
```python
CATEGORY_TO_CORRESPONDENT = {
    "Dining": "Comida",
    "Transport": "Transporte",
    "Lodging": "Alojamiento",
    "Culture": "Cultura",
    "Shopping": "Compras",
    "Health": "Salud",
    "Other": "Otros",
}
```

### Bug conocido — storage_path ignorado (posiblemente resuelto)
Paperless ignoraba el campo `storage_path` en `post_document/`. Causa probable: encoding incorrecto al mezclar `data=` y `files=` en httpx. Fix aplicado en commit 311aa7d (2026-04-29) — pendiente verificación tras redeploy.

---

## 🔄 Proveedores Externos

### Tipos de cambio
- **Usar:** `open.er-api.com/v6/latest/{base}` — sin API key, plan gratuito
- **No usar:** `exchangerate.host` — requiere API key desde 2025

### OCR
- **Usar:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — único motor
- **No usar:** Tesseract, PaddleOCR, modelos locales

---

## 📝 Git

```bash
# Formato obligatorio
feat(android): descripción
feat(web): descripción
feat(api): descripción
fix(proxy): descripción
fix(backend): descripción
docs: descripción

# Rama siempre main, nunca master
git branch -M main
```

**Nunca commitear:** `.env`, API keys, `node_modules/`, `__pycache__/`

---

## 🔒 Seguridad

- Passwords: bcrypt siempre
- JWT: access 30min, refresh 7d
- CORS: orígenes explícitos, nunca `*` en prod
- Uploads: validar MIME por magic bytes, no por extensión
- `ANTHROPIC_API_KEY`: solo en backend y bot, nunca en frontend
