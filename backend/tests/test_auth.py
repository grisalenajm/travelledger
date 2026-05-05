import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.config import settings

REGISTER_URL = "/api/auth/register"
LOGIN_URL = "/api/auth/login"
REFRESH_URL = "/api/auth/refresh"
VALIDATE_INVITE_URL = "/api/auth/validate-invite"
ME_URL = "/api/users/me"

USER_PAYLOAD = {
    "email": "test@example.com",
    "name": "Test User",
    "password": "TestPass1!secret",
    "currency_base": "EUR",
    "invite_code": settings.REGISTRATION_INVITE_CODE,
}


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    r = await client.post(REGISTER_URL, json=USER_PAYLOAD)
    assert r.status_code == 201
    data = r.json()
    assert data["email"] == USER_PAYLOAD["email"]
    assert data["name"] == USER_PAYLOAD["name"]
    assert "password_hash" not in data


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


@pytest.mark.asyncio
async def test_validate_invite_valid(client: AsyncClient):
    r = await client.post(VALIDATE_INVITE_URL, json={"code": settings.REGISTRATION_INVITE_CODE})
    assert r.status_code == 200
    assert r.json() == {"valid": True}


@pytest.mark.asyncio
async def test_validate_invite_invalid(client: AsyncClient):
    r = await client.post(VALIDATE_INVITE_URL, json={"code": "wrong-code"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_register_without_invite_code(client: AsyncClient):
    payload = {k: v for k, v in USER_PAYLOAD.items() if k != "invite_code"}
    payload["email"] = "noinvite@example.com"
    r = await client.post(REGISTER_URL, json=payload)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_register_with_wrong_invite_code(client: AsyncClient):
    payload = {**USER_PAYLOAD, "email": "wronginvite@example.com", "invite_code": "wrong-code"}
    r = await client.post(REGISTER_URL, json=payload)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_register_with_correct_invite_code(client: AsyncClient):
    payload = {**USER_PAYLOAD, "email": "correctinvite@example.com"}
    r = await client.post(REGISTER_URL, json=payload)
    assert r.status_code == 201
    assert r.json()["email"] == "correctinvite@example.com"
