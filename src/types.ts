export type Role = 'admin' | 'manager' | 'accountant' | 'operator'
export type Status = 'active' | 'pending' | 'debt' | 'archived' | 'paid' | 'unpaid' | 'completed' | 'in_progress' | 'paused' | 'annulled'
export type LabStatus = 'pending' | 'passed' | 'failed'
export type BarterAssetType = 'apartment' | 'car' | 'land' | 'equipment' | 'other'
export type BarterAssetStatus = 'active' | 'partial' | 'written_off' | 'owned'
export type BarterDealStatus = 'pending' | 'accepted' | 'sold' | 'active' | 'completed' | 'cancelled'
export type CementMovementType = 'incoming' | 'usage'

export type Profile = {
  id: string
  full_name: string
  login?: string
  role: Role
  email: string
  avatar_url?: string
}

export type Client = {
  id: string
  name: string
  login: string
  password?: string
  phone: string
  balance: number
  contract_type: string
  contract_total?: number
  cash_percent: number
  barter_percent: number
  cash_available?: number
  total_supplied_m3?: number
  total_paid?: number
  total_barter_value?: number
  status: Status
  updated_at: string
  archived?: boolean
  annulled?: boolean
}

export type ClientReport = {
  id: string
  client_id: string
  date: string
  object_name: string
  concrete_grade: string
  volume_m3: number
  amount: number
  paid_amount: number
  barter_amount: number
  cash_amount?: number
  transport_cost?: number
  trip_count?: number
  comment?: string
  status?: Status
  annulled?: boolean
  barter_asset_allocations?: { asset_id: string; amount: number }[]
}

export type BarterAsset = {
  id: string
  client_id: string
  type: BarterAssetType
  asset_name: string
  market_value: number
  cost_price: number
  linked_contract_amount?: number
  cash_paid?: number
  barter_value?: number
  total_paid_value?: number
  remaining_debt?: number
  asset_status?: BarterDealStatus
  used_amount: number
  remaining_amount: number
  status: BarterAssetStatus
  owned_at?: string
  source_client_name?: string
  photos: string[]
  comment: string
  apartment_number?: string
  building?: string
  block?: string
  floor?: string
  area_m2?: number
  rooms?: number
  address?: string
  car_make?: string
  car_model?: string
  car_year?: string
  license_plate?: string
  vin?: string
  mileage?: string
  color?: string
  condition?: string
  land_area?: string
  land_purpose?: string
  cadastral_number?: string
  equipment_name?: string
  equipment_model?: string
  equipment_year?: string
  created_at: string
  updated_at: string
}

export type CementMovement = {
  id: string
  date: string
  type: CementMovementType
  supplier?: string
  tons: number
  price_per_ton?: number
  total_cost: number
  reason?: string
  project?: string
  client_id?: string
  client_name?: string
  notes?: string
  annulled?: boolean
  created_at?: string
  updated_at?: string
}

export type FinanceTransaction = {
  id: string
  client_id?: string
  date: string
  category: string
  type: 'income' | 'expense' | 'barter'
  description: string
  amount: number
  payment_method?: string
  supplier_person?: string
  notes?: string
  linked_module?: string
  linked_record_id?: string
  status: Status
  annulled?: boolean
}

export type PaymentReceipt = {
  id: string
  receipt_number: string
  date: string
  client_id: string
  payment_type: string
  amount: number
  cash_amount: number
  barter_amount: number
  notes?: string
  operator_name?: string
  finance_transaction_id?: string
  created_at: string
}

export type DailyReportItem = {
  id: string
  client_name: string
  object_name: string
  concrete_grade: string
  volume_m3: number
  price: number
}

export type DailyReport = {
  id: string
  date: string
  items: DailyReportItem[]
  cement_t: number
  gravel_t: number
  sand_t: number
  additives_l: number
  salary_expense: number
  fuel_expense: number
  saved_at?: string
  annulled?: boolean
}

export type Invoice = {
  id: string
  number: string
  client_id: string
  delivery_ids?: string[]
  date: string
  due_date: string
  amount: number
  status: 'paid' | 'unpaid' | 'annulled'
}

export type LabReport = {
  id: string
  client_id?: string
  delivery_id?: string
  sample_date: string
  test_date: string
  date: string
  concrete_grade: string
  object_name: string
  slump: string
  temperature?: number
  cement_amount?: number
  sand_amount?: number
  gravel_amount?: number
  water_amount?: number
  notes?: string
  strength_mpa: number
  status: LabStatus
  annulled?: boolean
}

export type ExcavationReport = {
  id: string
  date: string
  object_name: string
  client_name: string
  client_phone: string
  location: string
  work_type: string
  total_volume_m3?: number
  completed_volume_m3?: number
  excavation_m3: number
  backfill_m3: number
  price_per_m3: number
  trip_count: number
  price_per_trip: number
  machinery: string
  driver: string
  workers: string
  worker_salary: number
  diesel_liters: number
  diesel_price: number
  machinery_rent: number
  other_expenses: number
  received_payment: number
  paid_amount?: number
  expenses?: number
  comment: string
  status: Status
  archived?: boolean
  annulled?: boolean
}

export type ActivityLog = {
  id: string
  created_at: string
  title: string
  description: string
  module: string
}

export type AppData = {
  profile: Profile
  clients: Client[]
  client_reports: ClientReport[]
  barter_assets: BarterAsset[]
  finance_transactions: FinanceTransaction[]
  payment_receipts: PaymentReceipt[]
  daily_reports: DailyReport[]
  invoices: Invoice[]
  lab_reports: LabReport[]
  excavation_reports: ExcavationReport[]
  cement_movements: CementMovement[]
  activity_logs: ActivityLog[]
}
