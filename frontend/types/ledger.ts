export type {
  TripStatus,
  Trip,
  TripSummary,
  LegMode,
  TripLeg,
  ExpenseCategory,
  PaymentMethod,
  Expense,
  ProgramType,
  LoyaltyCard,
  TripMapData,
  MapExpense,
  MapLeg,
  MapLegPoint,
} from "./index"

export interface TripCreate {
  name: string
  description?: string | null
  destination: string
  start_date: string
  end_date: string
  primary_currency: string
  budget: number
  budget_currency: string
  status?: "active" | "closed" | "draft"
}

export interface TripLegCreate {
  mode: "flight" | "train" | "bus" | "ferry" | "accommodation" | "car_rental" | "other"
  notes?: string | null
  expense_id?: string | null

  // Transporte
  origin?: string | null
  destination?: string | null
  origin_lat?: number | null
  origin_lng?: number | null
  destination_lat?: number | null
  destination_lng?: number | null
  departure_local?: string | null
  arrival_local?: string | null
  carrier?: string | null
  flight_number?: string | null
  reservation_number?: string | null
  locator_code?: string | null
  seat?: string | null
  loyalty_card_id?: string | null

  // Alojamiento
  accommodation_name?: string | null
  accommodation_address?: string | null
  accommodation_lat?: number | null
  accommodation_lng?: number | null
  accommodation_provider?: string | null
  check_in?: string | null
  check_out?: string | null

  // Alquiler de coche
  rental_company?: string | null
  pickup_location?: string | null
  pickup_lat?: number | null
  pickup_lng?: number | null
  dropoff_location?: string | null
  dropoff_lat?: number | null
  dropoff_lng?: number | null
  pickup_datetime?: string | null
  dropoff_datetime?: string | null
  confirmation_number?: string | null
}

export type TripLegUpdate = Partial<TripLegCreate> & { mode?: TripLegCreate["mode"] }

export interface ExpenseCreate {
  trip_id: string
  amount: number
  currency: string
  category: "Dining" | "Lodging" | "Transport" | "Culture" | "Shopping" | "Health" | "Other"
  description?: string | null
  date: string
  payment_method_id?: string | null
  billable?: boolean
  loyalty_card_id?: string | null
}

export interface ExpenseUpdate {
  amount?: number
  currency?: string
  category?: "Dining" | "Lodging" | "Transport" | "Culture" | "Shopping" | "Health" | "Other"
  description?: string | null
  date?: string
  payment_method_id?: string | null
  billable?: boolean
  loyalty_card_id?: string | null
  is_draft?: boolean
  location_name?: string | null
  location_lat?: number | null
  location_lng?: number | null
}

export interface LoyaltyCardCreate {
  program_name: string
  program_type: "airline" | "train" | "hotel" | "car_rental" | "other"
  membership_number: string
  tier?: string | null
  alias?: string | null
}

// ─── Boarding Pass OCR ───────────────────────────────────
export interface BoardingPassOcrResult {
  origin: string | null
  destination: string | null
  departure_local: string | null
  arrival_local: string | null
  flight_number: string | null
  carrier: string | null
  seat: string | null
  locator_code: string | null
  confidence: number | null
}
