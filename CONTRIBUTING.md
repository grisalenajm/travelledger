# Contributing to travel-ledger

Thank you for your interest in contributing! Here's how to get started.

## Getting started

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `docker compose exec backend pytest`
5. Commit with a conventional commit message (see below)
6. Open a Pull Request against `main`

## Conventional commits

```
feat(api): add endpoint for X
feat(web): add component for Y
fix(api): resolve issue with Z
fix(web): fix layout on mobile
refactor: extract shared helper
docs: update setup guide
chore: bump dependencies
```

## Development setup

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # edit with your config
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## What to contribute

- **Bug fixes** — always welcome
- **New travel email parser patterns** — new agencies, languages, or booking formats
- **Additional OCR provider adapters** — add a new provider in `services/ocr_providers/`
- **UI improvements** — shadcn/ui components, responsive fixes
- **Translations** — add a new `frontend/messages/XX.json` file
- **Documentation and setup guides** — deployment scenarios, reverse proxy configs

## What NOT to change without discussion first

- Database schema (Alembic migrations) — open an issue first
- Auth flow or security model
- Breaking changes to the API contract (see `CLAUDE.md` for the full contract)

## Code style

- **Backend:** follow existing FastAPI patterns — logic in services, not routers; no `print()`, use `logger`
- **Frontend:** TypeScript strict mode, no `any`, shadcn/ui components
- **Tests:** add `pytest` tests for new backend services

## Running tests

```bash
# All backend tests
docker compose exec backend pytest

# Single file
docker compose exec backend pytest tests/test_travel_email_parser.py -v

# With coverage
docker compose exec backend pytest --cov=app --cov-report=term-missing
```

## Reporting issues

Please include:
- Your deployment setup (Docker version, OS, whether using Paperless-ngx)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs: `docker compose logs backend --tail=50`
