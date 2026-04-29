# MEMORY.md — Estado del Proyecto Ledger

> **Actualizar este archivo después de cada sesión de trabajo.**
> Los agentes deben leerlo al inicio y actualizarlo al finalizar.

---

## 📅 Última actualización
- **Fecha:** 2026-04-30
- **Sesión:** Fix thumbnail (useState→derivada), fix confirm_password register, TAREA 2 ocr strip verificada en código

---

## ✅ Completado y funcionando en producción

### Infraestructura
- LXC 192.168.1.125 — backend :8000, frontend :3000, bot :8080
- postgres-ledger en NAS 192.168.1.154:5433, DB `ledger`
- Paperless-ngx en NAS :8004
- Repo GitHub: https://github.com/grisalenajm/travelledger, rama `main`
- Deploy: `git push origin main` → en LXC: `git pull && docker compose up -d --build [servicio]`
- SSH: clave `id_claude` configurada en LXC (en esta máquina de dev usar la clave disponible)

### Fases 0, 1, 2 — completadas sesiones anteriores
- docker-compose.yml, docker-compose.dev.yml, .env.example, nas-postgres-ledger.yml
- Auth: User model, bcrypt, JWT 30min/7d, routers auth + users, NextAuth, /login, /register
- CRUD: LoyaltyCard, Trip, TripLeg, Expense, ExchangeRate — 27/27 tests backend
- Web: dashboard, /trips, /trips/new, /trips/[id], /trips/[id]/edit
- Web: expense detail + edición, loyalty cards CRUD, settings (perfil + Paperless)
- Web: export CSV, imagen portada viaje, navbar, breadcrumbs, barra totales, selector días

### Fase 3 Backend OCR — completo
- app/models/expense.py — campos: is_draft, ocr_raw, ocr_confidence
- app/schemas/expense.py — ExpenseRead expone is_draft, ocr_confidence, paperless_doc_id
- alembic 0005 — aplicada correctamente en producción
- app/services/ocr_service.py — Haiku 4.5 Vision con prompt caching ephemeral
  - Strip markdown fences implementado en `_parse_response` (líneas 127-131)
  - Pendiente: verificar en producción que ocr_raw no contiene backticks
- app/services/paperless_service.py — PaperlessDuplicateError, PaperlessUploadError
- app/routers/receipts.py — POST /api/receipts/upload funciona end-to-end:
  - Valida MIME por magic bytes
  - OCR con Haiku → crea Expense is_draft=True
  - Sube a Paperless → guarda paperless_doc_id
  - Header X-Paperless-Warning: duplicate si es duplicado
  - db.commit() en línea 113 (fix crítico)
- app/routers/expenses.py — GET /api/expenses/{id}/receipt-image:
  - Proxy server-side de imagen de Paperless
  - Lee credenciales de BD via settings_service
  - Devuelve StreamingResponse con la imagen

### Fase 3 Frontend Web — completo
- components/upload-receipt-modal.tsx — drag&drop, file picker, multipart POST
- hooks/use-receipt-upload.ts — POST /api/proxy/receipts/upload, lee X-Paperless-Warning
- app/trips/[id]/page.tsx — botón "Escanear factura" + UploadReceiptModal
- components/expense-card.tsx — badge "Pendiente" si is_draft=true
- app/trips/[id]/expenses/[expenseId]/page.tsx — formulario edición completo:
  - Banner OCR draft con badge baja confianza
  - **Thumbnail + lightbox:** receiptUrl derivada de expense.paperless_doc_id (commit 66368e5)
  - onError con console.error (no oculta la imagen)

### Fix: confirm_password en /register (commit ea1db99, 2026-04-30)
- Schema Zod con refine: `data.password === data.confirm_password`
- Campo confirm_password en JSX con validación
- Destructurado antes del POST al backend (`{ confirm_password: _ignore, ...data }`)

### Fix: Thumbnail bug — useState/useEffect → variable derivada (commit 66368e5, 2026-04-30)
- **Causa:** el useEffect corría después del render, por lo que el primer render veía receiptUrl=null
- **Fix:** `const receiptUrl = expense?.paperless_doc_id ? \`/.../receipt-image\` : null`
- **Patrón aprendido:** para valores derivados síncronos de props/state, NUNCA usar useState+useEffect

### Fix: URLs de Paperless son internas (commits 614ae64 + bc7321d, 2026-04-30)
- Las URLs 192.168.1.154:8004 no son accesibles desde el browser
- Backend: GET /api/expenses/{id}/receipt-image hace proxy server-side con credenciales del usuario
- Frontend: img.src apunta a /api/proxy/expenses/{id}/receipt-image

### Fix: Paperless duplicado (commits a565016 + 5a990c5, 2026-04-29)
- Devuelve 201 + header X-Paperless-Warning: duplicate (no 502)
- Toast warning en frontend vía useReceiptUpload hook

### Fix: httpx multipart (commit 311aa7d, 2026-04-29)
- Todo en `files=` con tuplas, nunca mezclar `data=` + `files=`

---

## 🐛 Bugs Conocidos

| Bug | Estado | Detalle |
|-----|--------|---------|
| OCR strip markdown en producción | ⏳ Pendiente verificar | Código correcto en ocr_service.py L127-131 — verificar con `ocr_raw` en BD tras subir factura |
| `storage_path` ignorado por Paperless | ⏳ Posiblemente resuelto | Fix httpx multipart (311aa7d) — verificar tras redeploy |
| Refresh token en bucle | ❌ Pendiente | NextAuth llama a /api/auth/refresh varias veces — race condition en callback jwt |
| Thumbnail visible en producción | ⏳ Pendiente redeploy | Fix commiteado (66368e5) — necesita `docker compose up -d --build frontend` |

---

## ⏳ Pendiente por fase

| Fase | Estado | Detalle |
|------|--------|---------|
| Redeploy frontend+backend | Inmediato | `git pull origin main && docker compose up -d --build frontend backend` en LXC → abrir gasto con paperless_doc_id → verificar thumbnail |
| Verificar OCR strip | Inmediato tras redeploy | Ver sección bugs — subir factura y comprobar ocr_raw en BD |
| Fase 1 Android | Pendiente | LoginScreen, AuthRepository, AuthInterceptor, TokenStore, SplashScreen |
| Fase 2 Android | Pendiente | Room entities, repositories, pantallas |
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
| receiptUrl como variable derivada | No useState+useEffect | El efecto corre tras el render, causaba un render extra con null |

---

## 📝 Notas de Contexto

- **NAS:** 192.168.1.154 — postgres-ledger (5433), Paperless-ngx (8004), nginx-proxy-manager
- **LXC:** 192.168.1.125 — proyecto en /opt/ledger
- **Usuario principal BD:** 6f511736-ca98-4ccc-922a-89ff0d771571 — tiene credenciales Paperless
- **Usuario secundario BD:** 8927ff6e-1d40-4c46-9e91-284dbc4f554b — sin credenciales
- **Gasto de prueba:** expense_id: eff80490-8aa2-4c0d-8cb9-c70e3c899c93, paperless_doc_id: 684
- **Paperless correspondents:** Comida(2), Transporte(1), Alojamiento(3), otros(11)
- **Paperless document_types:** Invoice(1)
- **Paperless storage_paths:** Viajes(1)
- **Paperless tags:** travel(5)
- **Proxy:** siempre /api/proxy/*, nunca :8000 desde navegador
- **Decimales API:** FastAPI Decimal → string en JSON → usar Number() antes de toFixed()
