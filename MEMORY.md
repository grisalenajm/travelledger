# MEMORY.md — Estado del Proyecto Ledger

> **Actualizar este archivo después de cada sesión de trabajo.**
> Los agentes deben leerlo al inicio y actualizarlo al finalizar.

---

## 📅 Última actualización
- **Fecha:** 2026-04-29
- **Sesión:** Fix 1 Paperless duplicado (X-Paperless-Warning header + toast) + Fix 2 thumbnail/lightbox comprobante

---

## ✅ Completado

### Infraestructura
- LXC 192.168.1.125 — backend :8000, frontend :3000, bot :8080
- postgres-ledger en NAS 192.168.1.154:5433, DB `ledger`
- Paperless-ngx en NAS :8004
- Repo GitHub: https://github.com/grisalenajm/travelledger, rama `main`
- Deploy: `git push origin main` → en LXC: `git pull && docker compose up -d --build [servicio]`
- SSH sin contraseña desde PC → LXC configurado (clave `id_claude` sin passphrase)

### Fase 0 — Infraestructura
- docker-compose.yml, docker-compose.dev.yml, .env.example, nas-postgres-ledger.yml
- Skeletons backend, frontend, bot

### Fase 1 — Auth
- Backend: User model, bcrypt, JWT access 30min / refresh 7d, routers auth + users
- Web: NextAuth credentials, /login, /register, Zustand, middleware, proxy /api/proxy/*

### Fase 2 — CRUD
- Backend: LoyaltyCard, Trip, TripLeg, Expense, ExchangeRate — 27/27 tests
- Web: dashboard, /trips, /trips/new, /trips/[id], /trips/[id]/edit
- Web: expense detail + edición, loyalty cards CRUD, settings (perfil + Paperless)
- Web: export CSV, imagen de portada de viaje, comprobante en gasto
- Web: navbar global, breadcrumbs, barra de totales por moneda, selector de días

### Fase 2 — Fixes aplicados
- **307 Temporary Redirect resuelto:** `redirect_slashes=False` en todos los routers FastAPI
- **Proxy URL sin trailing slash:** `pathSegments.join("/")` sin slash final
- **Multipart proxy:** body como `arrayBuffer`, Content-Type preservado con boundary

### Fix: Paperless duplicado (2026-04-29, commits a565016 + 5a990c5)
- `PaperlessDuplicateError` y `PaperlessUploadError` en paperless_service.py
- Polling loop detecta "duplicate" en result_text y lanza `PaperlessDuplicateError`
- router receipts.py captura `PaperlessDuplicateError` → `duplicate_warning=True` → header `X-Paperless-Warning: duplicate` en JSONResponse
- `useReceiptUpload` hook lee el header y llama `toast.warning(...)` — gasto se crea igualmente
- Toast system mínimo: `hooks/use-toast.ts` + `components/ui/toaster.tsx` + `<Toaster />` en Providers

### Fix: Thumbnail + lightbox en expense detail (2026-04-29, commit 5a990c5)
- `expense/[expenseId]/page.tsx` hace GET receipt-url al cargar si hay `paperless_doc_id`
- Muestra thumbnail 96×96 clickable → lightbox fullscreen con botón cerrar y "Ver en Paperless"
- `onError` en img oculta la sección si la URL no carga
- Si no hay `paperless_doc_id`, la sección comprobante no existe (sin placeholder)

### Fix: Proxy de imagen de comprobante (2026-04-30, commits 614ae64 + bc7321d)
- **Problema:** `GET /receipt-url` devolvía URL interna `192.168.1.154:8004` — inaccesible desde el navegador del cliente
- **Patrón:** Las URLs de Paperless son internas al NAS — nunca devolverlas al frontend
- **Fix backend:** `GET /api/expenses/{id}/receipt-image` — descarga el documento de Paperless server-side con las credenciales del usuario y lo sirve como `StreamingResponse`
- **Fix frontend:** `<img src="/api/proxy/expenses/{id}/receipt-image">` — asignación directa sin fetch+json previo
- **Pendiente:** redeploy en LXC (SSH no disponible en esta sesión)

### Paperless — metadatos al subir imagen
- Correspondent: resuelto por categoría via `name__iexact` → ✅ funciona
- Document type: Invoice → ✅ funciona
- Tags: etiqueta "travel" → ✅ funciona
- Storage path: "Viajes" (ID 1) → ⏳ Pendiente re-test tras fix httpx multipart (commit 311aa7d)

### Fix httpx multipart (2026-04-29, commit 311aa7d)
- **Problema:** `data=form_data` + `files={"document": ...}` juntos en httpx causaban encoding incorrecto → Paperless ignoraba correspondent, document_type y storage_path
- **Fix:** todo en `files=` con tuplas `(None, valor)` para campos de texto y `(filename, bytes, mime)` para el fichero
- **Estado:** commiteado y pusheado, pendiente redeploy y verificación en UI

---

## 🐛 Bugs Conocidos

| Bug | Estado | Detalle |
|-----|--------|---------|
| `storage_path` ignorado por Paperless | ⏳ Posiblemente resuelto | Era consecuencia del encoding incorrecto en httpx. Fix aplicado (311aa7d) — verificar tras redeploy |
| Imagen comprobante no cargaba en expense detail | ✅ Resuelto | La URL de Paperless (192.168.1.x) es inaccesible desde el browser. Fix: endpoint `/receipt-image` proxy server-side (commits 614ae64 + bc7321d) — pendiente redeploy |
| `/register` sin confirm_password | ❌ Pendiente | Campo `confirm_password` ausente en formulario web |
| Refresh token en bucle | ❌ Pendiente | NextAuth llama a /api/auth/refresh varias veces seguidas — race condition en callback jwt |
| Paperless duplicado devolvía 502 | ✅ Resuelto | Ahora devuelve 201 con header X-Paperless-Warning: duplicate y el gasto se crea igualmente |

---

## ⏳ Pendiente por fase

| Fase | Estado | Detalle |
|------|--------|---------|
| Redeploy + verificar Paperless | Inmediato | `ssh -i ~/.ssh/<clave> root@192.168.1.125 "cd /opt/ledger && git pull origin main && docker compose up -d --build backend frontend"` → abrir gasto con imagen → verificar thumbnail visible y lightbox con imagen real |
| Fase 1 Android | Pendiente | LoginScreen, AuthRepository, AuthInterceptor, TokenStore, SplashScreen |
| Fase 2 Android | Pendiente | Room entities, repositories, pantallas |
| Fase 3 OCR | Pendiente | ocr_service.py + Receipt model + router POST /api/receipts/upload |
| Fase 4 Paperless | Pendiente | cascade delete al borrar gasto |
| Fase 5 Sync Android | Pendiente | WorkManager + endpoints push/pull |
| Fase 6 Export ZIP | Pendiente | CSV + ZIP imágenes de Paperless |
| Fase 7 Polish | Pendiente | FCM, dark mode, i18n |
| Fase 8 Bot Telegram | Pendiente | llm_service, handlers completos |

---

## 🔑 Decisiones de Arquitectura

| Decisión | Detalle | Razón |
|----------|---------|-------|
| BD dedicada en NAS | postgres-ledger puerto 5433 | Aislamiento |
| Sin Postgres en LXC | Usar del NAS | 768 MB RAM |
| Paperless-ngx vía API | Único almacén imágenes | Sin MinIO |
| Haiku 4.5 OCR | Sin Tesseract | 0 MB RAM en LXC, calidad superior |
| Dos monedas por gasto | amount + amount_base | Sin moneda intermedia |
| primary_currency OBLIGATORIO | Default al crear gastos | UX fluida |
| billable DEFAULT True | Corporativo por defecto | Caso uso principal |
| TripLeg datetimes naive | Sin UTC | Hora del billete |
| Flujo A vs B | Endpoints distintos | Manual nunca dispara OCR |
| Proxy /api/proxy/* | Server-side Next.js | Evita CORS y vars build-time |
| redirect_slashes=False | Todos los routers FastAPI | Evita 307 en POSTs |
| open.er-api.com | Sin API key, gratuito | exchangerate.host requiere key |
| Settings en BD | Paperless URL/token configurables | Sin .env para datos de usuario |
| Rama main | Nunca master | Estándar GitHub |
| httpx multipart files-only | Todo en `files=` con tuplas | data= + files= causa encoding incorrecto en Paperless |

---

## 📝 Notas de Contexto

- **NAS:** 192.168.1.154 — postgres-ledger (5433), Paperless-ngx (8004), nginx-proxy-manager
- **LXC:** 192.168.1.125 — proyecto en /opt/ledger
- **Paperless correspondents relevantes:** Comida(2), Transporte(1), Alojamiento(3), otros(11)
- **Paperless document_types relevantes:** Invoice(1)
- **Paperless storage_paths relevantes:** Viajes(1)
- **Paperless tags relevantes:** travel(5)
- **Proxy:** siempre /api/proxy/*, nunca :8000 desde navegador
- **Decimales API:** FastAPI Decimal → string en JSON → usar Number() antes de toFixed()
- **Claude Code SSH:** `ssh -i ~/.ssh/id_claude root@192.168.1.125`
