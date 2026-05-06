import io
import zipfile
from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

TRIP_PAYLOAD = {
    "name": "Report Test Trip",
    "destination": "Paris",
    "start_date": "2026-07-01",
    "end_date": "2026-07-10",
    "primary_currency": "EUR",
    "budget": "1000.00",
    "budget_currency": "EUR",
}


async def _create_trip(client, headers, payload=None):
    res = await client.post("/api/trips", json=payload or TRIP_PAYLOAD, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


async def _create_expense(client, headers, trip_id, **overrides):
    defaults = {
        "trip_id": trip_id,
        "amount": "50.00",
        "currency": "EUR",
        "category": "Dining",
        "date": "2026-07-02",
    }
    defaults.update(overrides)
    res = await client.post("/api/expenses", data=defaults, headers=headers)
    assert res.status_code == 201
    return res.json()


@pytest.mark.asyncio
async def test_get_trip_summary_totals(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers)
    await _create_expense(client, auth_headers, trip_id, amount="100.00", category="Dining", billable="true")
    await _create_expense(client, auth_headers, trip_id, amount="200.00", category="Lodging", billable="false")

    res = await client.get(f"/api/reports/trip/{trip_id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["trip_name"] == TRIP_PAYLOAD["name"]
    assert data["base_currency"] == "EUR"
    assert data["total_base"] == pytest.approx(300.0)
    assert data["total_billable"] == pytest.approx(100.0)
    assert data["total_personal"] == pytest.approx(200.0)
    assert len(data["by_category"]) == 2
    # Lodging has higher amount → first
    assert data["by_category"][0]["category"] == "Lodging"
    assert data["by_category"][0]["count"] == 1
    assert data["by_category"][0]["percentage"] == pytest.approx(200.0 / 300.0)


@pytest.mark.asyncio
async def test_get_trip_summary_empty_trip(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "Empty Trip"})
    res = await client.get(f"/api/reports/trip/{trip_id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_base"] == 0.0
    assert data["by_category"] == []
    assert data["by_currency"] == []


@pytest.mark.asyncio
async def test_export_csv_format(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "CSV Trip"})
    await _create_expense(client, auth_headers, trip_id, amount="75.00", category="Transport")

    res = await client.get(f"/api/reports/export/{trip_id}", headers=auth_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]

    content = res.content
    assert content[:3] == b"\xef\xbb\xbf"  # UTF-8 BOM
    text = content.decode("utf-8-sig")
    lines = text.strip().splitlines()
    assert lines[0].startswith("date,description,category")
    assert len(lines) == 2  # header + 1 expense


@pytest.mark.asyncio
async def test_export_csv_only_billable(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "Billable Trip"})
    await _create_expense(client, auth_headers, trip_id, amount="30.00", billable="true")
    await _create_expense(client, auth_headers, trip_id, amount="20.00", billable="false", date="2026-07-03")

    res = await client.get(f"/api/reports/export/{trip_id}?only_billable=true", headers=auth_headers)
    assert res.status_code == 200
    text = res.content.decode("utf-8-sig")
    lines = text.strip().splitlines()
    assert len(lines) == 2  # header + 1 billable expense only


@pytest.mark.asyncio
async def test_export_csv_date_range(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "DateRange Trip"})
    await _create_expense(client, auth_headers, trip_id, date="2026-07-01", amount="10.00")
    await _create_expense(client, auth_headers, trip_id, date="2026-07-05", amount="20.00")
    await _create_expense(client, auth_headers, trip_id, date="2026-07-09", amount="30.00")

    res = await client.get(
        f"/api/reports/export/{trip_id}?from=2026-07-03&to=2026-07-07",
        headers=auth_headers,
    )
    assert res.status_code == 200
    text = res.content.decode("utf-8-sig")
    lines = text.strip().splitlines()
    assert len(lines) == 2  # header + only the 2026-07-05 expense


@pytest.mark.asyncio
async def test_export_bundle_returns_zip(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "Bundle Trip"})
    await _create_expense(client, auth_headers, trip_id, amount="60.00", category="Culture")

    with patch(
        "app.services.paperless_service.get_credentials",
        new_callable=AsyncMock,
        return_value=(None, None),
    ):
        res = await client.get(f"/api/reports/export/{trip_id}/bundle", headers=auth_headers)

    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    assert "bundle" in res.headers["content-disposition"]

    zf = zipfile.ZipFile(io.BytesIO(res.content))
    names = zf.namelist()
    assert any(name.endswith(".csv") for name in names)


@pytest.mark.asyncio
async def test_export_bundle_csv_inside_zip(client, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "ZipContent Trip"})
    await _create_expense(client, auth_headers, trip_id, amount="40.00", category="Shopping")

    with patch(
        "app.services.paperless_service.get_credentials",
        new_callable=AsyncMock,
        return_value=(None, None),
    ):
        res = await client.get(f"/api/reports/export/{trip_id}/bundle", headers=auth_headers)

    zf = zipfile.ZipFile(io.BytesIO(res.content))
    csv_name = next(n for n in zf.namelist() if n.endswith(".csv"))
    csv_content = zf.read(csv_name).decode("utf-8-sig")
    lines = csv_content.strip().splitlines()
    assert lines[0].startswith("date,")
    assert len(lines) == 2


@pytest.mark.asyncio
async def test_delete_expense_calls_paperless_delete(client, db, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "Cascade Trip"})
    expense_data = await _create_expense(client, auth_headers, trip_id, amount="99.00")
    expense_id = expense_data["id"]

    from app.models.expense import Expense as ExpenseModel

    expense = await db.get(ExpenseModel, UUID(expense_id))
    expense.paperless_doc_id = 42
    await db.flush()

    with patch(
        "app.services.paperless_service.get_credentials",
        new_callable=AsyncMock,
        return_value=("http://paperless.local", "mytoken"),
    ):
        with patch(
            "app.services.paperless_service.delete_document",
            new_callable=AsyncMock,
        ) as mock_del:
            res = await client.delete(f"/api/expenses/{expense_id}", headers=auth_headers)

    assert res.status_code == 204
    mock_del.assert_called_once_with(
        paperless_url="http://paperless.local",
        token="mytoken",
        doc_id=42,
    )


@pytest.mark.asyncio
async def test_delete_expense_continues_if_paperless_fails(client, db, auth_headers):
    trip_id = await _create_trip(client, auth_headers, {**TRIP_PAYLOAD, "name": "Cascade Fail Trip"})
    expense_data = await _create_expense(client, auth_headers, trip_id, amount="55.00")
    expense_id = expense_data["id"]

    from app.models.expense import Expense as ExpenseModel

    expense = await db.get(ExpenseModel, UUID(expense_id))
    expense.paperless_doc_id = 99
    await db.flush()

    with patch(
        "app.services.paperless_service.get_credentials",
        new_callable=AsyncMock,
        return_value=("http://paperless.local", "mytoken"),
    ):
        with patch(
            "app.services.paperless_service.delete_document",
            new_callable=AsyncMock,
            side_effect=Exception("Paperless connection refused"),
        ):
            res = await client.delete(f"/api/expenses/{expense_id}", headers=auth_headers)

    assert res.status_code == 204

    get_res = await client.get(f"/api/expenses/{expense_id}", headers=auth_headers)
    assert get_res.status_code == 404
