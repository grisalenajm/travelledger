# MEMORY.md — Estado del Proyecto

> **Actualizar este archivo después de cada sesión de trabajo.**
> Los agentes deben leerlo al inicio y actualizarlo al finalizar.

---

## 📅 Última actualización
- **Fecha:** 2026-04-27
- **Agente:** Claude Sonnet 4.6
- **Sesión:** Settings Paperless, subida de imágenes Flujo A, fix 307 redirects

---

## ✅ Completado

- [x] Arquitectura completa definida (CLAUDE.md, MEMORY.md, BEST_PRACTICES.md, DESIGN_SYSTEM.md, TODO.md)
- [x] docker-compose.yml, docker-compose.dev.yml, .env.example, nas-postgres-ledger.yml
- [x] **postgres-ledger** corriendo en NAS 192.168.1.154:5433, DB `ledger`, usuario `ledger_user`
- [x] **LXC Proxmox** 192.168.1.125 — Ubuntu 24.04, Docker, proyecto en /opt/ledger
- [x] **Repo GitHub:** https://github.com/grisalenajm/travelledger — rama `main`
- [x] **FASE 0** — 3 servicios healthy
- [x] **FASE 1 Backend Auth** — JWT, bcrypt, rate limiting, HMAC bot, security headers
- [x] **FASE 1 Web Auth** — NextAuth, refresh automático, proxy /api/proxy/*
- [x] **Hardening seguridad** — SlowAPI, HMAC-SHA256, security headers, whitelist monedas
- [x] **FASE 2 Backend** — 27/27 tests (2026-04-25)
  - models: loyalty_card, trip, trip_leg, expense, exchange_rate, setting
  - migrations: 0001→0004 aplicadas
  - services: currency (open.er-api.com), loyalty_card, trip, leg, expense, settings, paperless
  - routers: loyalty_cards, trips, legs, expenses, currencies, settings, reports
- [x] **FASE 2 Web** — desplegado (2026-04-26)
  - types/ledger.ts, hooks React Query, componentes UI propios (sin Radix)
  - páginas: /, /trips, /trips/new, /trips/[id], /trips/[id]/edit, /trips/[id]/expenses/[id]
  - /settings — perfil + Paperless URL/token + verificar conexión
  - /settings/cards — loyalty cards CRUD
  - navbar global, breadcrumbs, selector de días, barra de totales por moneda
  - export CSV desde UI
  - subida de imagen en modal de gasto (Flujo A)
- [x] **Paperless integrado** — credenciales desde BD, título category/date/trip, etiqueta "travel"

---

## 🔄 En Progreso

- **Fix 307 redirect** — POST /api/expenses con multipart no llega al backend, el proxy no sigue el redirect
- **Fix refresh loop** — POST /api/auth/refresh aparece 4 veces seguidas en logs

---

## ⏳ Pendiente por Fase

- **FASE 2 Android** — skeleton, auth, CRUD
- **Fix pendiente:** /register sin confirm_password
- **FASE 3:** OCR Haiku + Scanner UI + Receipt model
- **FASE 4:** cascade delete Paperless al borrar expense
- **FASE 5:** offline sync Android
- **FASE 6:** export ZIP con imágenes de Paperless
- **FASE 7:** FCM + polish
- **FASE 8:** bot Telegram completo
- **FASE 9:** OCR confirmaciones vuelo → TripLeg

---

## 🐛 Bugs Conocidos

- **POST /api/expenses multipart → 307** — el proxy Next.js no sigue redirects en POST con body. El backend redirige /api/expenses → /api/expenses/. Fix pendiente: `redirect: 'follow'` + `duplex: 'half'` en proxy, y decoradores con slash en routers FastAPI
- **Refresh token en bucle** — NextAuth llama a /api/auth/refresh 4 veces seguidas. Probable race condition en el callback jwt
- **/register sin confirm_password** — campo confirm_password ausente en formulario web y RegisterScreen Android
- **Imagen en gasto no llega a Paperless** — consecuencia del bug 307 anterior

---

## 🔑 Decisiones de Arquitectura

| Decisión | Detalle | Razón |
|----------|---------|-------|
| BD dedicada en NAS | postgres-ledger, puerto 5433 | Aislamiento |
| Sin Postgres en LXC | Usar del NAS | 768 MB RAM |
| Paperless-ngx vía API | Único almacén imágenes | Sin MinIO |
| Haiku 4.5 OCR | Sin Tesseract | 0 MB RAM en LXC |
| Dos monedas por gasto | amount + amount_base | Sin moneda intermedia |
| primary_currency OBLIGATORIO | Default al crear gastos | UX fluida |
| billable DEFAULT True | Corporativo por defecto | Caso uso principal |
| TripLeg datetimes naive | Sin UTC | Hora del billete |
| Flujo A vs B | Endpoints distintos | Manual → sin OCR |
| Proxy /api/proxy/* | Server-side | Evita CORS y vars build-time |
| core/limiter.py separado | Módulo propio | Evita circulares |
| HMAC-SHA256 bot | Key + firma + anti-replay | Seguridad |
| openapi_url=None prod | Sin Swagger | No exponer contrato |
| open.er-api.com | Sin API key, gratuito | exchangerate.host requiere key desde 2025 |
| shadcn sin Radix | Componentes propios | Radix no instalado |
| Rama main | Nunca master | Estándar GitHub |
| Deploy desde GitHub | git pull + build en LXC | Sin tar/scp |
| Settings en BD | Paperless URL/token configurables desde UI | Sin .env para datos de usuario |
| Paperless título | category_date_tripslug | Naming consistente para export |
| Paperless etiqueta | "travel" auto-creada | Filtrado fácil en Paperless |
| Imagen no bloquea gasto | Upload falla silencioso | Gasto se crea aunque Paperless no responda |

---

## 📝 Notas de Contexto

- **NAS:** 192.168.1.154 — postgres-ledger (5433), Paperless-ngx (8004), nginx-proxy-manager
- **LXC:** 192.168.1.125 — proyecto en /opt/ledger
- **Repo:** https://github.com/grisalenajm/travelledger — rama `main`
- **Deploy:** `git push origin main` → `ssh root@192.168.1.125 "cd /opt/ledger && git pull origin main && docker compose up -d --build [servicio]"`
- **Proxy:** siempre /api/proxy/*, nunca :8000 desde navegador
- **Decimales API:** FastAPI Decimal → string en JSON → usar Number() antes de toFixed()
- **Bot mode:** polling en dev, webhook en prod
- **Android:** minSdk 26, targetSdk 34
- **Paperless:** credenciales en tabla settings (user_id, key, value) — no en .env
- **Claude Code en Windows:** instalado en C:\Users\grisa\.local\bin\claude.exe. PATH: agregar C:\Users\grisa\.local\bin

---

## ⚠️ Fixes Aplicados

| Fix | Problema | Solución |
|-----|----------|----------|
| bcrypt>=4.0,<5.0 | incompatible con passlib 1.7.4 | fijar en requirements.txt |
| next.config.mjs | Next.js 14 no soporta .ts | renombrar |
| ENV HOSTNAME=0.0.0.0 | healthcheck fallaba | añadir al Dockerfile |
| DNS BuildKit | conflicto Tailscale | daemon.json con 8.8.8.8 |
| ports en lugar de expose | backend inaccesible | mapear 8000:8000 |
| proxy req.text() | detached ArrayBuffer | leer con req.text(), new NextResponse(text) |
| core/limiter.py separado | circulares con SlowAPI | módulo propio |
| SLOWAPI_NO_LIMITS + no-op | 429 en tests | no-op en limiter cuando env var presente |
| Token refresh NextAuth | JWT no se refrescaba | refreshAccessToken() + accessTokenExpires |
| date_t alias Python 3.12 | shadowing tipo date en clase | from datetime import date as date_t |
| PRAGMA foreign_keys=ON | SQLite no enforcea cascades | event listener en conftest.py |
| convert() wrappea _fetch_rate | mock bypasaba try/except | try/except propio en convert() |
| exchangerate.host → open.er-api.com | requiere API key desde 2025 | open.er-api.com gratuito sin key |
| Number() en decimales frontend | toFixed() falla con string | envolver con Number() |
| Git LXC unrelated histories | repo vacío sin historial | rm -rf .git + clonar .git desde /tmp |
| Sync código antes de build | build con código anterior | siempre git pull antes de build |
| Rama main | Claude pusheaba a master | git branch -M main |
| 204 No Content en PUT settings | frontend parseaba body vacío como error | NextResponse(null, {status: 204}) |
| settings router naming conflict | import settings sobreescribía config | renombrar a settings_router |
| Trailing slash 307 en routers | FastAPI redirige sin slash | decoradores con "/" no "" en todos los routers |
| upload_document sin db/user_id | trips.py llamaba sin argumentos | pasar db y user.id en todos los callers |
