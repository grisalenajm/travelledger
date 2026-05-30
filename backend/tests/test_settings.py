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
        json={"key": "paperless_url", "value": "ftp://192.0.2.1"},
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
        json={"key": "paperless_url", "value": "http://paperless.example.com:8004"},
        headers=auth_headers,
    )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_get_settings_token_set_after_saving(client: AsyncClient, auth_headers: dict):
    await client.put(
        PUT_URL,
        json={"key": "paperless_token", "value": "supersecrettoken"},
        headers=auth_headers,
    )
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["paperless_token_set"] is True
    assert "paperless_token" not in data or data.get("paperless_token") is None


@pytest.mark.asyncio
async def test_get_settings_token_not_set(client: AsyncClient, auth_headers: dict):
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["paperless_token_set"] is False


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
    # Token should still be set
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.json()["paperless_token_set"] is True


@pytest.mark.asyncio
async def test_put_settings_new_token_saved(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "paperless_token", "value": "newtoken456"},
        headers=auth_headers,
    )
    assert r.status_code == 204
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.json()["paperless_token_set"] is True


@pytest.mark.asyncio
async def test_set_anthropic_api_key(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "anthropic_api_key", "value": "sk-ant-test-key"},
        headers=auth_headers,
    )
    assert r.status_code == 204
    r = await client.get(SETTINGS_URL, headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["anthropic_api_key_set"] is True
    # The raw key must never appear in the response
    assert "sk-ant" not in str(data)


@pytest.mark.asyncio
async def test_unknown_setting_key_rejected(client: AsyncClient, auth_headers: dict):
    r = await client.put(
        PUT_URL,
        json={"key": "evil_key", "value": "hax"},
        headers=auth_headers,
    )
    assert r.status_code == 400
