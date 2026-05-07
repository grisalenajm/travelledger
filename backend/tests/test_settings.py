import pytest
from httpx import AsyncClient

SETTINGS_URL = "/api/settings"
PUT_URL = "/api/settings"


@pytest.mark.asyncio
async def test_ssrf_loopback_blocked(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "paperless_url", "value": "http://127.0.0.1:5433"},
        headers=auth_headers,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_ssrf_link_local_blocked(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "paperless_url", "value": "http://169.254.169.254"},
        headers=auth_headers,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_ssrf_ftp_scheme_blocked(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "paperless_url", "value": "ftp://192.168.1.154"},
        headers=auth_headers,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_ssrf_localhost_name_blocked(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "paperless_url", "value": "http://localhost:8000"},
        headers=auth_headers,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_ssrf_valid_url_accepted(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "paperless_url", "value": "http://192.168.1.154:8004"},
        headers=auth_headers,
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_get_settings_masks_token(client: AsyncClient, auth_headers: dict):
    await client.put(
        PUT_URL,
        json={"key": "paperless_token", "value": "supersecrettoken"},
        headers=auth_headers,
    )
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["paperless_token"] == "***"


@pytest.mark.asyncio
async def test_get_settings_no_token_returns_null(client: AsyncClient, auth_headers: dict):
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["paperless_token"] is None


@pytest.mark.asyncio
async def test_put_settings_placeholder_ignored(client: AsyncClient, auth_headers: dict):
    await client.put(
        PUT_URL,
        json={"key": "paperless_token", "value": "realtoken123"},
        headers=auth_headers,
    )
    # Echo back the masked placeholder — should not overwrite the real token
    await client.put(
        PUT_URL,
        json={"key": "paperless_token", "value": "***"},
        headers=auth_headers,
    )
    # Verify the real token is still there (GET returns "***", not null)
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.json()["paperless_token"] == "***"


@pytest.mark.asyncio
async def test_put_settings_new_token_saved(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "paperless_token", "value": "newtoken456"},
        headers=auth_headers,
    )
    assert r.status_code == 204
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.json()["paperless_token"] == "***"
