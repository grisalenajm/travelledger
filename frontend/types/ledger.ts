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
  mode: "flight" | "train" | "car" | "bus" | "ferry" | "other"
  origin: string
  destination: string
  departure_local: string
  arrival_local: string
  carrier?: string | null
  reservation_number?: string | null
  locator_code?: string | null
  loyalty_card_id?: string | null
  notes?: string | null
}

export interface ExpenseCreate {
  trip_id: string
  amount: number
  currency: string
  category: "Dining" | "Lodging" | "Transport" | "Culture" | "Shopping" | "Health" | "Other"
  description?: string | null
  date: string
  payment_method?: "card" | "cash" | "transfer" | "other" | null
  billable?: boolean
  loyalty_card_id?: string | null
}

export interface ExpenseUpdate {
  amount?: number
  currency?: string
  category?: "Dining" | "Lodging" | "Transport" | "Culture" | "Shopping" | "Health" | "Other"
  description?: string | null
  date?: string
  payment_method?: "card" | "cash" | "transfer" | "other" | null
  billable?: boolean
  loyalty_card_id?: string | null
}

export interface LoyaltyCardCreate {
  program_name: string
  program_type: "airline" | "train" | "hotel" | "car_rental" | "other"
  membership_number: string
  tier?: string | null
  alias?: string | null
}
