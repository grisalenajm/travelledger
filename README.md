# 🧳 travel-ledger

> Self-hosted travel expense manager with AI receipt OCR, automatic travel email import,
> and multi-currency support. Your data stays on your server.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

### 📸 AI Receipt OCR
Photograph a receipt and Ledger extracts amount, date, merchant, and category automatically.
Choose your AI backend per user: **Claude Haiku**, **GPT-4o mini**, **Gemini Flash**, or **Ollama** (local, free).

### 📧 Travel Email Import
Forward booking confirmation emails to a dedicated mailbox.
Ledger parses them into trip legs automatically — flights, hotels, car rentals, trains.
Works with any travel agency format, `.ics` / iCalendar attachments, and emails in **English, Spanish, and French**.
Set a sender filter (e.g. `@booking.com`) or leave it empty to process everything.

### 🌍 Self-hosted, your data
Deploy with Docker Compose on any server or NAS.
No cloud accounts, no subscriptions, no analytics.
Each instance is independent — fork, deploy, own your data.

### 💱 Multi-currency
Record expenses in the currency you paid. Ledger converts to your reporting currency
using daily exchange rates from [open.er-api.com](https://www.exchangerate-api.com/).

### ✈️ Trip Itinerary
Track the full journey: flights with automatic distance (Haversine), hotels, car rentals, trains.
Map view powered by Leaflet + OpenStreetMap. Boarding pass OCR fills in flight details.

### 🧾 Corporate reimbursement
Flag expenses as billable. Export as **CSV** or **ZIP bundle** (CSV + receipt images).
Optional [Paperless-ngx](https://docs.paperless-ngx.com/) integration for receipt archiving.

### 👥 Multi-user
Admin invites users via email. **Guest mode** for read-only access sharing.
Per-user OCR provider, API keys, language, and currency settings.

### 🌐 Multilingual
Interface in **English**, **Spanish**, and **French**.

---

## 🖥️ Screenshots

> _Coming soon_

---

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- PostgreSQL 16 (can run alongside in Docker or on a NAS)
- An AI API key for OCR — or Ollama running locally (free)

### 1. Clone and configure

```bash
git clone https://github.com/grisalenajm/travelledger.git
cd travelledger
cp .env.example .env
```

Edit `.env` — minimum required:

```env
DATABASE_URL=postgresql+asyncpg://ledger_user:yourpassword@db:5432/ledger
SECRET_KEY=your-random-32-char-string-here
```

Generate a secure `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

> ⚠️ **Save your `SECRET_KEY` somewhere safe.** It encrypts API keys stored in the database.
> It cannot be changed after setup without a migration script.

### 2. Start

```bash
docker compose up -d
```

Open **`http://localhost:3000/setup`** to create your admin account.

> The `/setup` page is only shown when no users exist. After the first account is created it
> redirects to `/login` automatically. Invite additional users from Settings → Users.

### 3. Configure in Settings

- **OCR provider** — pick your AI model and enter your API key
- **Base currency** — your reporting currency (e.g. EUR, USD, CHF)
- **Email import** — optional IMAP mailbox for booking email parsing
- **Paperless-ngx** — optional receipt archive

---

## 📧 Travel Email Import

The email import feature turns booking confirmation emails into trip legs automatically.

**Setup:**
1. Create a dedicated email address (e.g. `travel@yourdomain.com`)
2. Go to **Settings → Email Integration** and enter the IMAP credentials
3. Forward any booking confirmation email to that address
4. Ledger polls the inbox every N minutes (configurable) and creates pending legs
5. Review pending legs at **Trips → Pending**, assign to a trip

**What gets parsed:**
| Type | Extracted fields |
|------|-----------------|
| Flight | Origin, destination, departure/arrival, carrier, flight number, locator |
| Hotel | Name, address, check-in, check-out, confirmation number |
| Car rental | Company, pickup/dropoff location and datetime, confirmation |
| Train | Origin, destination, departure/arrival, operator, locator |
| `.ics` attachment | All of the above, highest confidence |

**Confidence scoring:** if the parser cannot extract enough fields (confidence < 0.2),
a blank leg is created with `confirmed=false` and a note — you fill it in manually.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  FastAPI Backend                     │
│  PostgreSQL · Paperless-ngx · LLM OCR (pluggable)   │
└──────────────────────┬──────────────────────────────┘
                       │
                   Next.js 14
                   Web App
```

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 · FastAPI · SQLAlchemy async · Alembic · Pydantic v2 |
| Database | PostgreSQL 16 |
| Receipt storage | Paperless-ngx (optional) or Docker volume |
| OCR | Claude Haiku 4.5 / GPT-4o mini / Gemini Flash 1.5 / Ollama |
| Frontend | Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Recharts |
| Maps | Leaflet + Nominatim (OpenStreetMap, no API key required) |
| Auth | JWT — 30 min access + 7 day HttpOnly refresh cookie |
| i18n | Custom context + JSON (no external library) |

---

## ⚙️ Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async connection string |
| `SECRET_KEY` | 32+ char random string — JWT signing + API key encryption |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOW_REGISTRATION` | `false` | Allow self-registration without admin invite |
| `ANTHROPIC_API_KEY` | — | Instance-level OCR key (users can also set their own) |
| `IMAP_HOST` / `IMAP_USER` / `IMAP_PASSWORD` | — | Email import polling (see `.env.example`) |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | — | Email delivery for user invitations |
| `UNSPLASH_ACCESS_KEY` | — | Automatic trip cover photos |

All other settings (OCR provider, Paperless, per-user email) are configured in the web UI
and stored encrypted in the database.

See `.env.example` for the full list with descriptions.

---

## 🤝 Contributing

Contributions are welcome — bug fixes, new email parser patterns, OCR adapters, translations.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

```bash
# Run backend tests
docker compose exec backend pytest

# Run with hot reload (development)
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

---

## 🗺️ Roadmap

- [ ] Deployment guide (nginx + Let's Encrypt + docker compose production)
- [ ] Rate limiting example for `/api/receipts/upload` (nginx config)
- [ ] `SECRET_KEY` rotation migration script
- [ ] Android app (Kotlin/Compose) — architecture complete, resuming soon
- [ ] Multiple documents per trip leg
- [ ] Budget per category

---

## 📄 License

[MIT](LICENSE)

---

## 🙏 Credits

Built with:
[shadcn/ui](https://ui.shadcn.com/) ·
[Recharts](https://recharts.org/) ·
[Leaflet](https://leafletjs.com/) ·
[Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org/) ·
[open.er-api.com](https://www.exchangerate-api.com/) ·
[Paperless-ngx](https://docs.paperless-ngx.com/) ·
[icalendar](https://icalendar.readthedocs.io/)
