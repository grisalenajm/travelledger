# TODO.md — Ledger

> **Leer `CLAUDE.md` y `MEMORY.md` antes de empezar.**
> Al completar una tarea: marcar `[x]` aquí **y** actualizar `MEMORY.md`.
> Bot y Android aparcados indefinidamente — no tocar.

---

## 📋 Leyenda

```
[ ] — pendiente
[x] — completado
[~] — en progreso (anotar agente y fecha)
[!] — bloqueante: otros no pueden avanzar hasta que esté hecho
[✗] — descartado permanentemente
```

**Agentes activos:**
- `[BE]` — Backend FastAPI
- `[Web]` — Frontend Next.js
- `[Docs]` — Documentación

**Aparcados (no tocar):**
- `[And]` — Android
- `[Bot]` — Bot Telegram

---

## 🏗️ Arquitectura de despliegue (FIJA)

```
NAS UGREEN (192.168.1.154)
├── postgres-ledger  → puerto 5433, DB "ledger"
├── paperless-ngx    → almacén facturas
└── nginx-proxy-manager → TLS

LXC Proxmox (192.168.1.125, 768 MB RAM)
└── /opt/ledger/docker-compose.yml
    ├── backend   (FastAPI :8000)
    ├── frontend  (Next.js :3000)
    └── bot       (skeleton, aparcado)
```

---

## ✅ FASE 0 — Infraestructura *(COMPLETADA)*

- [x] docker-compose.yml, docker-compose.dev.yml, .env.example
- [x] Healthchecks en los 3 servicios
- [x] Backend skeleton — FastAPI, CORS, routers, /health, Alembic
- [x] Frontend skeleton — Next.js 14, shadcn tokens
- [x] Bot skeleton — aparcado
- [ ] README: instrucciones para levantar postgres-ledger en NAS
- [ ] Seed SQL — categorías iniciales

---

## ✅ FASE 1 — Autenticación *(Backend + Web COMPLETADOS)*

### Backend ✅
- [x] Modelo `User` + migration `0001_create_users`
- [x] `core/security.py` — bcrypt, JWT access 30min / refresh 7d
- [x] Router `/api/auth` — register, login, refresh, logout
- [x] Router `/api/users` — GET/PUT /me
- [x] Tests: test_auth_*, test_jwt_*

### Backend — refactor self-hosted `[BE]` `[!]`
- [x] [!] Eliminar toda lógica de `invite_code` de auth_service, schemas, router
- [x] [!] Añadir `is_admin: bool = False` a modelo `User`
- [x] [!] Migration `0006_add_is_admin`
- [x] [!] Añadir `ALLOW_REGISTRATION: bool = False` a `config.py` y `.env.example`
- [x] [!] Lógica registro: tabla vacía → libre + is_admin=True; no vacía → chequear `ALLOW_REGISTRATION`
- [x] [!] Nuevo endpoint `GET /api/auth/status` → `{registration_open: bool, has_users: bool}`
- [x] Actualizar tests de auth para nueva lógica

### Web — refactor /register `[Web]`
- [x] Eliminar campo `invite_code` del formulario `/register`
- [x] Añadir campo `confirm_password` — validación client-side al submit
- [x] Llamar `GET /api/auth/status` al cargar `/register` — si cerrado → mostrar mensaje
- [x] Actualizar `lib/api.ts` si necesario

---

## ✅ FASE 2 — CRUD Core *(COMPLETADA)*

- [x] Backend: Trips, TripLegs, Expenses, LoyaltyCards, Currency (27/27 tests)
- [x] Web: todas las pantallas CRUD

---

## ✅ FASE 3 — OCR & Scanner *(COMPLETADA)*

- [x] Backend: ocr_service.py, receipts router, Flujo B
- [x] Web: /expenses/scan, /expenses/scan/confirm

---

## ✅ FASE 4 — Paperless integración *(COMPLETADA)*

- [x] Backend: cascade delete Paperless en expense_service.delete()
- [x] Web: "Ver factura" en expense detail

---

## 🔴 FASE X — Preparación self-hosted `[BE]` `[Web]` ← ATACAR PRIMERO

> Prerequisito para todas las demás fases web. Hacer antes de cualquier otra cosa.

### Backend `[BE]` ✅
- [x] [!] Refactor auth — ver FASE 1 Backend arriba
- [x] [!] `core/crypto_utils.py` — `encrypt(value: str) -> str` / `decrypt(value: str) -> str` con Fernet
- [x] [!] Añadir `cryptography>=42.0` a `requirements.txt`
- [x] [!] Actualizar `settings_service.py` — ENCRYPTED_KEYS, set/get cifra/descifra
- [x] [!] Actualizar schemas Settings — `*_set: bool`, nunca clave real
- [x] Actualizar `ocr_service.py` — `get_api_key(user_id)` con fallback a env
- [x] Actualizar `paperless_service.py` — `get_credentials(user_id)` con fallback a env

### Backend — volumen temporal `[BE]` ✅
- [x] Añadir `local_path: str | None` a modelo `Expense` + migration `0007_add_local_path`
- [x] Añadir `aiofiles>=23.0` a `requirements.txt`
- [x] Actualizar `docker-compose.yml` — bind mount `./uploads:/app/uploads` (chown 1001:1001 en host, no volumen nombrado)
- [x] Actualizar `receipts.py` — si paperless_enabled=false → guardar en `/app/uploads/`
- [x] Actualizar `expense_service.delete()` — borrar `local_path` si existe
- [x] Implementar `settings_service.migrate_to_paperless(user_id: UUID)`
- [x] Actualizar router `PUT /api/settings` — trigger migrate_to_paperless en background
- [x] **Pendiente deploy**: `alembic upgrade head` en LXC — migration `0005_add_is_admin` aplicada en producción

### Web — /settings/profile ampliado `[Web]`
- [x] Sección "Cuenta": nombre, email, moneda base, cambio de password
- [x] Sección "OCR": campo `anthropic_api_key` (tipo password), indicador "configurada ✓ / no configurada"
- [x] Sección "Paperless": `paperless_url`, `paperless_token` (tipo password), toggle on/off, botón "Verificar conexión"
- [x] Sección "Apariencia": selector idioma (ES/EN), toggle dark/light/system
- [x] Actualizar `hooks/use-settings.ts` — GET /api/settings con nuevos campos
- [x] Fix toggle `paperless_enabled` — llama a la API en onClick inmediatamente (no en submit)
- [x] `paperless_enabled` guardado explícitamente en BD con `set_setting()`

### Backend — fixes post-deploy mayo 2026 `[BE]`
- [x] Endpoint `POST /api/settings/migrate-now` — migración síncrona Paperless con stats `{migrated, failed, errors}`
- [x] Fix `await db.refresh(trip)` tras commit en `trip_service.create()` — evita MissingGreenlet
- [x] Refresh token persistente en cookie HttpOnly 7 días
- [x] `uploads/` añadido a `.gitignore`
- [x] `UNSPLASH_ACCESS_KEY` añadida a `environment:` en `docker-compose.yml`

### Web — fixes post-deploy mayo 2026 `[Web]`
- [x] Eliminado campo `loyalty_card_id` (frequent flyer) de formularios de gastos web
- [x] Fix badge total viaje — usa `currency_base` del usuario en lugar de `budget_currency`

---

## ✅ FASE 6 — Export Bundle Web `[Web]` *(COMPLETADA)*

- [x] `components/export-modal.tsx`: toggle solo facturables, rango fechas, botón CSV (outline) + botón ZIP (primary), blob download
- [x] Conectar botón "Exportar" en `/trips/[id]/page.tsx` → abre modal
- [x] Título Paperless = `{slug_viaje}_{category}_{date}` vía `title_parts` en receipts.py

---

## 🟠 FASE 7 — Polish Web `[Web]`

### Dark mode
- [ ] Instalar `next-themes`
- [ ] `ThemeProvider` en `app/layout.tsx`
- [ ] Configurar Tailwind `darkMode: 'class'` (ya debería estar)
- [ ] Variables CSS para colores dark en `globals.css`
- [ ] Aplicar `dark:` clases en todos los componentes (navbar, cards, modales, forms, sidebar)
- [ ] Respetar `prefers-color-scheme` por defecto

### i18n con next-intl
- [ ] Instalar `next-intl`
- [ ] Crear `/messages/es.json` — todas las cadenas en español
- [ ] Crear `/messages/en.json` — todas las cadenas en inglés
- [ ] `i18n.ts` — configuración request sin prefijo de ruta
- [ ] Actualizar `next.config.mjs` con plugin `createNextIntlPlugin`
- [ ] `NextIntlClientProvider` en `app/layout.tsx`
- [ ] Traducir por orden: navbar → auth (login, register) → trips → expenses → settings
- [ ] Locale en cookie `NEXT_LOCALE` — gestionado por next-intl

---

## 📝 FASE Docs — README comunidad `[Docs]`

- [ ] Audit de historial git: `git log --all` + `git grep "192.168.1"` — limpiar antes de publicar
- [ ] `README.md` orientado a comunidad self-hosted:
  - Descripción del proyecto y capturas
  - Requisitos: Docker, Docker Compose, PostgreSQL 16, Paperless-ngx (opcional)
  - Instrucciones de despliegue paso a paso
  - Variables de entorno explicadas (tabla)
  - Primer login: primer usuario = admin automáticamente
  - Configuración OCR (Anthropic API key en perfil)
  - Configuración Paperless en perfil de usuario
  - `ALLOW_REGISTRATION` para añadir más usuarios
  - FAQ: ¿puedo usar sin Paperless? ¿sin Anthropic key propia?

---

## 🟣 FASE 5 — Sync Android `[And]` ← APARCADA

> No implementar. Sin cliente Android activo no hay forma de validar.

---

## ⚫ FASE 7b — Push Notifications `[BE]` ← APARCADA

> FCM requiere Android. Aparcado.

---

## 🤖 FASE 8 — Bot Telegram `[Bot]` ← APARCADO

> Aparcado indefinidamente.

---

## 🗂️ FASE 9 — Backlog

- [x] Foto automática de portada de viaje (Unsplash) — `cover_image_path` en Trip + GET /trips/{id}/cover + TripCard/detail muestran imagen
- [x] Hero card en /trips: viaje cuyas fechas incluyen hoy ("En curso"), sin importar status field; si múltiples → el de start_date más reciente; si ninguno → no se muestra
- [x] Cambiar estado de viaje desde lista (chip dropdown en TripCard) y desde detalle (StatusChip junto a botón editar)
- [ ] TripLegs CRUD en web (pantalla de tramos)
- [ ] Estadísticas agregadas entre viajes (dashboard global)
- [ ] OCR de confirmaciones de vuelo → crear TripLeg automático
- [ ] Presupuesto por viaje — pantalla de configuración
- [ ] `[✗]` Integración Uber — descartada
