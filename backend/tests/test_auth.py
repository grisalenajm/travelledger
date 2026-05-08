import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.config import settings

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
REFRESH_URL = "/api/auth/refresh"
STATUS_URL = "/api/auth/status"
ME_URL = "/api/users/me"

USER_PAYLOAD = {
    "email": "test@example.com",
    "name": "Test User",
    "password": "TestPass1!secret",
    "currency_base": "EUR",
}


@pytest.mark.asyncio
async def test_auth_status_empty_db(client: AsyncClient):
    r = await client.get(STATUS_URL)
    assert r.status_code == 200
    data = r.json()
    assert data["has_users"] is False
    assert data["registration_open"] is True


@pytest.mark.asyncio
async def test_auth_status_with_user(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_REGISTRATION", False)
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    r = await client.get(STATUS_URL)
    assert r.status_code == 200
    data = r.json()
    assert data["has_users"] is True
    assert data["registration_open"] is False


@pytest.mark.asyncio
async def test_register_first_user(client: AsyncClient):
    r = await client.post(REGISTER_URL, json=USER_PAYLOAD)
    assert r.status_code == 201
    data = r.json()
    assert data["email"] == USER_PAYLOAD["email"]
    assert data["name"] == USER_PAYLOAD["name"]
    assert data["is_admin"] is True
    assert "password_hash" not in data


@pytest.mark.asyncio
async def test_register_second_user_is_not_admin(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    payload2 = {**USER_PAYLOAD, "email": "second@example.com"}
    r = await client.post(REGISTER_URL, json=payload2)
    assert r.status_code == 201
    assert r.json()["is_admin"] is False


@pytest.mark.asyncio
async def test_register_closed_when_allow_registration_false(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_REGISTRATION", False)
    # First user: allowed (empty DB)
    r = await client.post(REGISTER_URL, json=USER_PAYLOAD)
    assert r.status_code == 201
    # Second user: blocked
    payload2 = {**USER_PAYLOAD, "email": "second@example.com"}
    r = await client.post(REGISTER_URL, json=payload2)
    assert r.status_code == 403
    assert "cerrado" in r.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    r = await client.post(REGISTER_URL, json=USER_PAYLOAD)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    r = await client.post(LOGIN_URL, json={"email": USER_PAYLOAD["email"], "password": USER_PAYLOAD["password"]})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    r = await client.post(LOGIN_URL, json={"email": USER_PAYLOAD["email"], "password": "wrong"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    login_r = await client.post(LOGIN_URL, json={"email": USER_PAYLOAD["email"], "password": USER_PAYLOAD["password"]})
    token = login_r.json()["access_token"]

    r = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == USER_PAYLOAD["email"]


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    r = await client.get(ME_URL)
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    login_r = await client.post(LOGIN_URL, json={"email": USER_PAYLOAD["email"], "password": USER_PAYLOAD["password"]})
    refresh_token = login_r.json()["refresh_token"]

    r = await client.post(REFRESH_URL, json={"refresh_token": refresh_token})
    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_refresh_with_access_token_fails(client: AsyncClient):
    await client.post(REGISTER_URL, json=USER_PAYLOAD)
    login_r = await client.post(LOGIN_URL, json={"email": USER_PAYLOAD["email"], "password": USER_PAYLOAD["password"]})
    access_token = login_r.json()["access_token"]

    r = await client.post(REFRESH_URL, json={"refresh_token": access_token})
    assert r.status_code == 401
