// ─── Auth ────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  name: string
  currency_base: string
  telegram_chat_id: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// ─── Trips ───────────────────────────────────────────────
export type TripStatus = "active" | "closed" | "draft"

export interface Trip {
  id: string
  name: string
  description: string | null
  destination: string
  start_date: string
  end_date: string
  primary_currency: string
  budget: number
  budget_currency: string
  status: TripStatus
  cover_doc_id: number | null
  cover_image_path: string | null
  created_at: string
}

export interface TripSummary {
  spent_base: number
  budget_base: number
  currency_base: string
  percentage: number
  expense_count: number
  legs_count: number
}

// ─── Trip Legs ───────────────────────────────────────────
export type LegMode = "flight" | "train" | "bus" | "ferry" | "accommodation" | "car_rental" | "other"

export interface TripLeg {
  id: string
  trip_id: string | null
  user_id: string | null
  mode: LegMode
  source: string | null
  confirmed: boolean
  notes: string | null
  expense_id: string | null
  has_document: boolean

  // Transporte (flight | train | bus | ferry | other)
  origin: string | null
  destination: string | null
  origin_lat: number | null
  origin_lng: number | null
  destination_lat: number | null
  destination_lng: number | null
  departure_local: string | null
  arrival_local: string | null
  carrier: string | null
  flight_number: string | null
  reservation_number: string | null
  locator_code: string | null
  seat: string | null
  distance_km: number | null
  loyalty_card_id: string | null

  // Alojamiento
  accommodation_name: string | null
  accommodation_address: string | null
  accommodation_lat: number | null
  accommodation_lng: number | null
  accommodation_provider: string | null
  check_in: string | null
  check_out: string | null

  // Alquiler de coche
  rental_company: string | null
  pickup_location: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_location: string | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  pickup_datetime: string | null
  dropoff_datetime: string | null
  confirmation_number: string | null

  created_at: string
  updated_at: string
}

// ─── Expenses ────────────────────────────────────────────
export type ExpenseCategory =
  | "Dining"
  | "Lodging"
  | "Transport"
  | "Culture"
  | "Shopping"
  | "Health"
  | "Other"

export type PaymentMethod = "card" | "cash" | "transfer" | "other"

export interface Expense {
  id: string
  trip_id: string
  user_id: string
  amount: number
  currency: string
  amount_base: number
  rate_date: string
  category: ExpenseCategory
  description: string | null
  date: string
  payment_method: string | null
  payment_method_id: string | null
  billable: boolean
  loyalty_card_id: string | null
  paperless_doc_id: number | null
  has_receipt: boolean
  is_draft: boolean
  ocr_confidence: number | null
  location_lat: number | null
  location_lng: number | null
  location_name: string | null
  created_at: string
  warning?: string
}

// ─── Loyalty Cards ───────────────────────────────────────
export type ProgramType = "airline" | "train" | "hotel" | "car_rental" | "other"

export interface LoyaltyCard {
  id: string
  user_id: string
  program_name: string
  program_type: ProgramType
  membership_number: string
  tier: string | null
  alias: string | null
  created_at: string
}

// ─── Stats ───────────────────────────────────────────────
export interface CategoryStat {
  category: string
  total: number
  count: number
  pct: number
}

export interface DailyStat {
  date: string
  total: number
}

export interface PaymentStat {
  method: string
  total: number
  count: number
}

export interface MerchantStat {
  name: string
  total: number
  count: number
}

export interface TripStats {
  trip_id: string
  currency_base: string
  total_base: number
  expense_count: number
  duration_days: number
  avg_per_day: number
  budget_base: number
  budget_pct: number
  by_category: CategoryStat[]
  by_day: DailyStat[]
  by_payment: PaymentStat[]
  top_merchants: MerchantStat[]
}

// ─── Global Stats ────────────────────────────────────────

export interface MonthStat {
  month: string
  total: number
}

export interface TripComparison {
  trip_id: string
  trip_name: string
  destination: string
  total: number
  expense_count: number
}

export interface GlobalStats {
  currency_base: string
  year: number
  period: string
  total_base: number
  expense_count: number
  trip_count: number
  by_category: CategoryStat[]
  by_payment: PaymentStat[]
  by_month: MonthStat[]
  by_trip: TripComparison[]
  top_merchants: MerchantStat[]
}

// ─── Flight Stats ────────────────────────────────────────

export interface CarrierStat {
  carrier: string
  flights: number
  km: number
}

export interface RouteStat {
  route: string
  flights: number
  km: number
}

export interface FlightStats {
  year: number
  period: string
  total_flights: number
  total_km: number
  avg_km_per_flight: number
  by_carrier: CarrierStat[]
  top_routes: RouteStat[]
}

// ─── Map ─────────────────────────────────────────────────
export interface MapLegPoint {
  lat: number
  lng: number
  label: string
}

export interface MapLeg {
  id: string
  mode: string
  points: MapLegPoint[]
}

export interface MapExpense {
  id: string
  description: string | null
  amount: number
  currency: string
  category: string
  date: string
  location_lat: number
  location_lng: number
  location_name: string | null
}

export interface TripMapData {
  expenses: MapExpense[]
  legs: MapLeg[]
}

// ─── Notifications ───────────────────────────────────────

export interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  read: boolean
  created_at: string
}

export interface NotificationCount {
  unread: number
}

// ─── OCR ─────────────────────────────────────────────────
export interface OcrResult {
  receipt_id: string
  paperless_doc_id: number
  merchant: string
  date: string
  amount: number
  currency: string
  category: ExpenseCategory
  payment_method: PaymentMethod | null
  description: string
  confidence: number
}
