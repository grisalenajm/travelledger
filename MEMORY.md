# MEMORY.md — Estado del Proyecto

> **Actualizar este archivo después de cada sesión de trabajo.**
> Los agentes deben leerlo al inicio y actualizarlo al finalizar.

---

## 📅 Última actualización
- **Fecha:** 2026-05-08
- **Agente:** Claude Sonnet 4.6 (sesión de arquitectura)
- **Sesión:** Revisión de arquitectura — decisiones self-hosted, perfil usuario, i18n, dark mode, registro

---

## ✅ Completado

- [x] Arquitectura multiplataforma definida (Android + Web + Bot + Backend)
- [x] CLAUDE.md — modelos de datos completos, flujos A/B, export bundle, TripLeg, LoyaltyCard
- [x] BEST_PRACTICES.md — creado y actualizado
- [x] DESIGN_SYSTEM.md — creado con tokens completos
- [x] DESIGN_SYSTEM_addendum.md — pantallas adicionales
- [x] TODO.md — reorganizado con fases 0–9
- [x] docker-compose.yml, docker-compose.dev.yml, .env.example, nas-postgres-ledger.yml
- [x] **FASE 0** — backend, frontend, bot skeleton desplegados
- [x] **FASE 1 Backend Auth** — desplegado y smoke-tested
- [x] **FASE 2 Backend** — trips/expenses/legs/loyalty-cards/currency; 27/27 tests
- [x] **FASE 2 Web** — desplegado (todas las pantallas)
- [x] **Settings API** — modelo, migration 0004, service, router, paperless_service per-user
- [x] **FASE 1 Web Auth** — NextAuth, Zustand, middleware, proxy
- [x] **FASE 3 Backend OCR** — ocr_service.py, receipts router, Flujo B
- [x] **FASE 3 Web** — /expenses/scan, /expenses/scan/confirm
- [x] **FASE 4** — cascade delete Paperless, "Ver factura" web
- [x] **FASE 6 Backend** — export_service.py CSV+ZIP, router reports
- [x] **SSH LXC** — clave ED25519, GitHub SSH, remote SSH configurado

---

## 🏗️ Decisiones de arquitectura tomadas en sesión 2026-05-08

### Self-hosted y comunidad
- Repo público: cada usuario despliega su propia instancia
- Eliminado `REGISTRATION_INVITE_CODE` y endpoint `validate-invite`
- Primer usuario que se registra → `is_admin=True`, registro libre
- Usuarios adicionales: controlado por `ALLOW_REGISTRATION` en `.env` (default: `false`)
- README orientado a comunidad self-hosted — a generar
- Audit de historial git antes de publicar repo

### Registro web
- Sin invite_code
- `confirm_password` — validación client-side al submit
- Si `ALLOW_REGISTRATION=false` y ya hay usuarios → mostrar mensaje claro en `/register`
- Nuevo endpoint: `GET /api/auth/status` → `{registration_open: bool, has_users: bool}`

### Perfil de usuario (`/settings/profile`)
- Cuenta: nombre, email, password, moneda base, idioma, tema
- OCR: `anthropic_api_key` por usuario (cifrada Fernet), fallback a `.env`
- Paperless: `paperless_url` + `paperless_token` (cifrado Fernet) + toggle `paperless_enabled`, fallback a `.env`
- Devolver `anthropic_api_key_set: bool` y `paperless_token_set: bool` — nunca la clave real
- Botón "Verificar conexión Paperless"

### Almacenamiento temporal de imágenes
- Sin Paperless configurado → volumen Docker `ledger_uploads` montado en `/app/uploads/`
- Ruta: `/app/uploads/{user_id}/{expense_id}.{ext}`
- Campo nuevo en `Expense`: `local_path: str | None`
- Al configurar Paperless → migración automática async con `BackgroundTasks`
- Migración: si falla un archivo → loguear y continuar (no bloquear)

### Cifrado de claves sensibles
- Librería: `cryptography` (Fernet)
- `crypto_utils.py` — `encrypt(value)` / `decrypt(value)`
- `SECRET_KEY` del `.env` como fuente de la clave Fernet
- Solo claves con sufijo `_key` o `_token` en `user_settings` se cifran

### i18n
- Librería: `next-intl`
- Sin prefijo de locale en URLs
- Locale detectado del navegador por defecto
- Override en `/settings/profile` → cookie `NEXT_LOCALE`
- Idiomas: ES (default) + EN
- Mensajes en `/messages/es.json` y `/messages/en.json`

### Dark mode
- Tailwind `darkMode: 'class'`
- Por defecto: sistema (`prefers-color-scheme`)
- Override en `/settings/profile` → `localStorage` + clase `dark` en `<html>`
- `ThemeProvider` en `layout.tsx`

### Modal Export (FASE 6 Web)
- Rango de fechas opcional — sin rango = viaje completo
- Toggle "Solo facturables" arranca en **ON**
- Botones: CSV y ZIP

### Aparcado indefinidamente
- Bot Telegram (FASE 8) — no implementar
- Android (todas las fases) — no implementar
- FASE 5 Sync — no implementar sin cliente Android activo

---

## ⏳ Pendiente — próximas tareas (orden de ejecución)

### 1. Backend — preparación self-hosted `[BE]`
- [ ] Eliminar lógica de `invite_code` de `auth_service.py`, `schemas/auth.py`, `router/auth.py`
- [ ] Añadir `is_admin: bool = False` al modelo `User` + migration `0005_add_is_admin`
- [ ] Añadir `ALLOW_REGISTRATION` a `config.py` y `.env.example`
- [ ] Implementar lógica registro: vacío → libre + is_admin; no vacío → chequear `ALLOW_REGISTRATION`
- [ ] Nuevo endpoint `GET /api/auth/status`
- [ ] Actualizar tests de auth

### 2. Backend — crypto y settings `[BE]`
- [ ] Añadir `cryptography>=42.0` a `requirements.txt`
- [ ] Crear `core/crypto_utils.py` — `encrypt()` / `decrypt()` con Fernet
- [ ] Actualizar `settings_service.py` — cifrar/descifrar en get/set para claves sensibles
- [ ] Actualizar schemas Settings — añadir `anthropic_api_key_set`, `paperless_token_set`
- [ ] Añadir fallback en `ocr_service.py` — leer key de `user_settings` primero, luego `.env`
- [ ] Añadir fallback en `paperless_service.py` — leer URL/token de `user_settings` primero, luego `.env`

### 3. Backend — volumen temporal de imágenes `[BE]`
- [ ] Añadir campo `local_path: str | None` a modelo `Expense` + migration `0006_add_local_path`
- [ ] Añadir `aiofiles>=23.0` a `requirements.txt`
- [ ] Actualizar `expense_service.py` — guardar en `/app/uploads/` si no hay Paperless
- [ ] `expense_service.delete()` — borrar `local_path` si existe además del doc Paperless
- [ ] `settings_service.py` — `migrate_to_paperless(user_id)` como coroutine para `BackgroundTasks`
- [ ] Actualizar `PUT /api/settings` — si `paperless_url`/`paperless_token` se guardan → disparar migración en background
- [ ] Actualizar `docker-compose.yml` — añadir volumen `ledger_uploads`

### 4. Web — /register refactor `[Web]`
- [ ] Eliminar campo `invite_code` del formulario
- [ ] Añadir campo `confirm_password` con validación al submit
- [ ] Llamar `GET /api/auth/status` al cargar `/register` — si cerrado, mostrar mensaje
- [ ] Actualizar `useAuthStore` si necesario

### 5. Web — /settings/profile ampliado `[Web]`
- [ ] Sección OCR: campo `anthropic_api_key` (tipo password, con indicador `_set`)
- [ ] Sección Paperless: `paperless_url`, `paperless_token` (tipo password), toggle, botón verificar
- [ ] Selector idioma (ES/EN)
- [ ] Toggle dark/light/system
- [ ] Actualizar `hooks/use-settings.ts`

### 6. Web — i18n con next-intl `[Web]`
- [ ] Instalar `next-intl`
- [ ] Crear `/messages/es.json` y `/messages/en.json`
- [ ] Configurar `next.config.mjs` con plugin next-intl
- [ ] `i18n.ts` — request config sin prefijo de ruta
- [ ] `ThemeProvider` + `NextIntlClientProvider` en `layout.tsx`
- [ ] Traducir componentes por orden: navbar → auth → trips → expenses → settings

### 7. Web — dark mode `[Web]`
- [ ] Instalar `next-themes`
- [ ] `ThemeProvider` en `layout.tsx`
- [ ] Variables CSS Tailwind para colores dark
- [ ] Aplicar `dark:` clases en todos los componentes

### 8. Web — modal export (FASE 6) `[Web]`
- [ ] `components/export-modal.tsx`
  - Toggle "Solo facturables" — estado inicial ON
  - DatePickerWithRange opcional
  - Botón CSV → `GET /api/reports/export/{id}?format=csv`
  - Botón ZIP → `GET /api/reports/export/{id}/bundle`
- [ ] Conectar en `/trips/[id]/page.tsx`

### 9. README comunidad `[Docs]`
- [ ] Descripción del proyecto
- [ ] Requisitos previos (Docker, Paperless, PostgreSQL)
- [ ] Variables de entorno explicadas
- [ ] Instrucciones de despliegue paso a paso
- [ ] Sección primer login (primer usuario = admin)
- [ ] Sección configuración Paperless y OCR desde perfil
- [ ] Audit de historial git antes de hacer repo público

---

## 🐛 Bugs conocidos

- `/register` (web) no solicita confirmación de contraseña — `confirm_password` ausente `[Web]` → ver tarea 4
- `/register` (web) enviaba `invite_code` — campo eliminado con refactor `[Web]` → ver tarea 4

---

## 📚 Documentos del Proyecto

| Documento | Contenido |
|---|---|
| `CLAUDE.md` | Arquitectura general, modelos, contrato API, reglas |
| `MEMORY.md` | Este archivo — estado actual |
| `TODO.md` | Tareas globales web/backend |
| `BEST_PRACTICES.md` | Convenciones backend/web |
| `DESIGN_SYSTEM.md` | Tokens visuales, componentes, pantallas |
| `DESIGN_SYSTEM_addendum.md` | Pantallas adicionales |

---

## 📌 Notas para agentes

1. Orden de lectura: `CLAUDE.md` → `MEMORY.md` → `BEST_PRACTICES.md` → `TODO.md`
2. Al completar: marcar `[x]`, actualizar `MEMORY.md`
3. Al encontrar bug: añadir a "Bugs conocidos"
4. Al terminar: commit + push → LXC: `git pull && docker compose up -d --build [servicio]`
5. Nunca avanzar una fase sin que sus bloqueantes `[!]` estén completos
6. Verificar siempre con `grep` que el código nuevo está dentro del contenedor
7. Bot y Android aparcados — no tocar esos directorios
8. Crypto: cifrar SIEMPRE claves con sufijo `_key` o `_token` en `user_settings`
9. Settings API: NUNCA devolver claves reales — solo `*_set: bool`
10. Imágenes sin Paperless: guardar en volumen Docker, campo `Expense.local_path`

---

## 🔧 Fixes Aplicados (histórico)

- **Fix 1** — Sync de código al LXC antes de build (2026-04-25): tar + scp o git pull
- **Fix 2** — Proxy route faltante (2026-04-25): `app/api/proxy/[...path]/route.ts` necesario
- **Fix 3** — lib/api.ts con URL relativa (2026-04-25): `API_BASE = ""`
- **Fix 4** — `passlib` incompatible con `bcrypt>=5`: pin `bcrypt>=4.0,<5.0`
- **Fix 5** — `next.config.ts` no soportado en Next.js 14: usar `next.config.mjs`
- **Fix 6** — Next.js standalone: añadir `ENV HOSTNAME=0.0.0.0` en Dockerfile
- **Fix 7** — BuildKit DNS en LXC con Tailscale: `{"dns": ["8.8.8.8","1.1.1.1"]}` en daemon.json
- **Fix 8** — `NEXT_PUBLIC_API_URL` embebida en build: usar proxy `/api/proxy/*` con `API_INTERNAL_URL`
- **Fix 9** — `useSearchParams` sin Suspense en Next.js 14: envolver en `<Suspense>` (2026-05-07)
- **Fix 10** — `useCreateExpense` enviaba JSON, backend espera FormData: usar `api.postForm()` (2026-05-07)

---

## 🖥️ Acceso a infraestructura

```bash
# LXC (proyecto)
ssh -i ~/.ssh/id_ed25519 root@192.168.1.125
cd /opt/ledger

# NAS — verificar postgres-ledger
nc -zv 192.168.1.154 5433

# Si backend unhealthy tras reinicio NAS:
docker compose restart backend
```
