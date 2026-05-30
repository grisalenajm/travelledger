from pydantic import BaseModel


class CategoryStat(BaseModel):
    category: str
    total: float
    count: int
    pct: float


class DailyStat(BaseModel):
    date: str
    total: float


class PaymentStat(BaseModel):
    method: str
    total: float
    count: int


class MerchantStat(BaseModel):
    name: str
    total: float
    count: int


class TripStats(BaseModel):
    trip_id: str
    currency_base: str
    total_base: float
    expense_count: int
    duration_days: int
    avg_per_day: float
    budget_base: float
    budget_pct: float
    by_category: list[CategoryStat]
    by_day: list[DailyStat]
    by_payment: list[PaymentStat]
    top_merchants: list[MerchantStat]


# ─── Global Stats ─────────────────────────────────────────────────────────────

class MonthStat(BaseModel):
    month: str
    total: float


class TripComparison(BaseModel):
    trip_id: str
    trip_name: str
    destination: str
    total: float
    expense_count: int


class GlobalStats(BaseModel):
    currency_base: str
    year: int
    period: str
    total_base: float
    expense_count: int
    trip_count: int
    by_category: list[CategoryStat]
    by_payment: list[PaymentStat]
    by_month: list[MonthStat]
    by_trip: list[TripComparison]
    top_merchants: list[MerchantStat]


# ─── Flight Stats ─────────────────────────────────────────────────────────────

class CarrierStat(BaseModel):
    carrier: str
    flights: int
    km: float


class RouteStat(BaseModel):
    route: str
    flights: int
    km: float


class FlightStats(BaseModel):
    year: int
    period: str
    total_flights: int
    total_km: float
    avg_km_per_flight: float
    by_carrier: list[CarrierStat]
    top_routes: list[RouteStat]
