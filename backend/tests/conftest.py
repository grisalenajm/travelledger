import os

# Must be set before importing app modules (settings instantiated at import time)
os.environ.setdefault("SLOWAPI_NO_LIMITS", "1")
os.environ.setdefault("ALLOW_REGISTRATION", "true")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5433/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-chars-for-testing-ok")
os.environ.setdefault("WEBHOOK_SECRET", "test-webhook-secret-min-32-characters-ok!")
os.environ.setdefault("WEBHOOK_USER_EMAIL", "test@ledger.dev")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


# function-scoped: cada test arranca con BD vacía (aislamiento real;
# los routers hacen commit, así que el rollback del fixture db no basta)
@pytest_asyncio.fixture
async def engine():
    e = create_async_engine(TEST_DATABASE_URL, echo=False)

    @event.listens_for(e.sync_engine, "connect")
    def _set_sqlite_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with e.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield e
    async with e.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await e.dispose()


@pytest_asyncio.fixture
async def db(engine):
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db):
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client):
    """Registra un usuario de test y devuelve sus headers de autenticación."""
    await client.post(
        "/api/auth/register",
        json={
            "email": "test@ledger.dev",
            "name": "Test User",
            "password": "TestPass1!secret",
            "currency_base": "EUR",
        },
    )
    res = await client.post(
        "/api/auth/login",
        json={"email": "test@ledger.dev", "password": "TestPass1!secret"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_headers_chf(client):
    """Usuario con currency_base=CHF para tests de conversión."""
    await client.post(
        "/api/auth/register",
        json={
            "email": "chf@ledger.dev",
            "name": "CHF User",
            "password": "TestPass1!secret",
            "currency_base": "CHF",
        },
    )
    res = await client.post(
        "/api/auth/login",
        json={"email": "chf@ledger.dev", "password": "TestPass1!secret"},
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
