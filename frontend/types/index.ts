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
export type LegMode = "flight" | "train" | "car" | "bus" | "ferry" | "other"

export interface TripLeg {
  id: string
  trip_id: string
  mode: LegMode
  origin: string
  destination: string
  departure_local: string
  arrival_local: string
  carrier: string | null
  reservation_number: string | null
  locator_code: string | null
  loyalty_card_id: string | null
  notes: string | null
  created_at: string
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
  payment_method: PaymentMethod | null
  billable: boolean
  loyalty_card_id: string | null
  paperless_doc_id: number | null
  created_at: string
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
