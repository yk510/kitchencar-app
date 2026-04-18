// ============================================================
// Supabase テーブルの TypeScript 型定義
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: Location
        Insert: Omit<Location, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Location, 'id' | 'created_at'>>
      }
      events: {
        Row: Event
        Insert: Omit<Event, 'id' | 'created_at'>
        Update: Partial<Omit<Event, 'id' | 'created_at'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Transaction, 'id' | 'created_at'>>
      }
      product_master: {
        Row: ProductMaster
        Insert: Omit<ProductMaster, 'id' | 'created_at'>
        Update: Partial<Omit<ProductMaster, 'id' | 'created_at'>>
      }
      cost_history: {
        Row: CostHistory
        Insert: Omit<CostHistory, 'id' | 'changed_at'>
        Update: never
      }
      product_sales: {
        Row: ProductSale
        Insert: Omit<ProductSale, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProductSale, 'id' | 'created_at'>>
      }
      stall_logs: {
        Row: StallLog
        Insert: Omit<StallLog, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StallLog, 'id' | 'created_at'>>
      }
      weather_logs: {
        Row: WeatherLog
        Insert: Omit<WeatherLog, 'id' | 'created_at'>
        Update: Partial<Omit<WeatherLog, 'id' | 'created_at'>>
      }
      operation_plans: {
        Row: OperationPlan
        Insert: Omit<OperationPlan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OperationPlan, 'id' | 'created_at'>>
      }
      operation_plan_days: {
        Row: OperationPlanDay
        Insert: Omit<OperationPlanDay, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OperationPlanDay, 'id' | 'created_at'>>
      }
      weather_forecasts: {
        Row: WeatherForecast
        Insert: Omit<WeatherForecast, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WeatherForecast, 'id' | 'created_at'>>
      }
      sales_forecasts: {
        Row: SalesForecast
        Insert: Omit<SalesForecast, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SalesForecast, 'id' | 'created_at'>>
      }
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserProfile, 'created_at'>>
      }
      vendor_profiles: {
        Row: VendorProfile
        Insert: Omit<VendorProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<VendorProfile, 'created_at'>>
      }
      organizer_profiles: {
        Row: OrganizerProfile
        Insert: Omit<OrganizerProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<OrganizerProfile, 'created_at'>>
      }
      event_offers: {
        Row: EventOffer
        Insert: Omit<EventOffer, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EventOffer, 'id' | 'created_at'>>
      }
      event_applications: {
        Row: EventApplication
        Insert: Omit<EventApplication, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EventApplication, 'id' | 'created_at'>>
      }
      application_messages: {
        Row: ApplicationMessage
        Insert: Omit<ApplicationMessage, 'id' | 'created_at'>
        Update: Partial<Omit<ApplicationMessage, 'id' | 'created_at'>>
      }
    }
  }
}

// ---- エンティティ型 ----

export interface Location {
  id: string
  user_id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  user_id: string
  event_name: string
  event_date: string
  location_id: string | null
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  txn_no: string
  txn_date: string          // YYYY-MM-DD
  txn_time: string          // HH:MM:SS
  day_of_week: number       // 0=月 〜 6=日
  hour_of_day: number       // 0〜23
  location_id: string | null
  event_id: string | null
  total_amount: number
  tax_amount: number
  discount_total: number
  payment_method: string | null
  is_return: boolean
  raw_txn_kind: string | null
  created_at: string
  updated_at: string
}

export interface ProductMaster {
  id: string
  user_id: string
  product_name: string
  cost_amount: number | null    // 原価額（円）
  cost_rate: number | null      // 原価率（%）
  cost_updated_at: string | null
  created_at: string
}

export interface CostHistory {
  id: string
  user_id: string
  product_name: string
  cost_amount: number | null
  cost_rate: number | null
  changed_at: string
}

export interface ProductSale {
  id: string
  user_id: string
  txn_no: string
  txn_date: string
  product_name: string
  unit_price: number
  quantity: number
  subtotal: number
  location_id: string | null
  event_id: string | null
  created_at: string
  updated_at: string
}

export interface StallLog {
  id: string
  user_id: string
  log_date: string
  location_id: string
  event_id: string | null
  created_at: string
  updated_at: string
}

export interface WeatherLog {
  id: string
  user_id: string
  log_date: string
  location_id: string
  weather_type: '晴れ' | '曇り' | '雨' | '雪'
  weather_code: number | null
  temperature_max: number | null
  temperature_min: number | null
  created_at: string
}

export interface OperationPlan {
  id: string
  user_id: string
  plan_month: string
  title: string | null
  source_image_name: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface OperationPlanDay {
  id: string
  user_id: string
  plan_id: string
  plan_date: string
  operation_type: string
  holiday_flag: string | null
  location_id: string | null
  location_name: string | null
  municipality: string | null
  event_name: string | null
  business_start_time: string | null
  business_end_time: string | null
  ai_source_text: string | null
  ai_confidence: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WeatherForecast {
  id: string
  user_id: string
  plan_day_id: string
  forecast_date: string
  location_id: string | null
  latitude: number | null
  longitude: number | null
  weather_type: '晴れ' | '曇り' | '雨' | '雪' | null
  weather_code: number | null
  temperature_max: number | null
  temperature_min: number | null
  created_at: string
  updated_at: string
}

export interface SalesForecast {
  id: string
  user_id: string
  plan_day_id: string
  forecast_date: string
  predicted_sales: number
  predicted_txn_count: number
  predicted_avg_ticket: number
  predicted_gross_profit: number
  confidence_score: number | null
  forecast_basis: string | null
  created_at: string
  updated_at: string
}

export interface UserProfile {
  user_id: string
  role: 'vendor' | 'organizer'
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface VendorProfile {
  user_id: string
  business_name: string
  owner_name: string | null
  contact_email: string | null
  phone: string | null
  main_menu: string | null
  logo_image_url: string | null
  instagram_url: string | null
  x_url: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface OrganizerProfile {
  user_id: string
  organizer_name: string
  contact_name: string | null
  contact_email: string | null
  phone: string | null
  logo_image_url: string | null
  instagram_url: string | null
  x_url: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface EventOffer {
  id: string
  user_id: string
  organizer_profile_id: string | null
  title: string
  event_date: string
  event_end_date: string | null
  venue_name: string
  venue_address: string | null
  municipality: string | null
  recruitment_count: number
  fee_type: 'fixed' | 'revenue_share' | 'fixed_plus_revenue_share' | 'free'
  stall_fee: number | null
  revenue_share_rate: number | null
  application_deadline: string | null
  load_in_start_time: string | null
  load_in_end_time: string | null
  sales_start_time: string | null
  sales_end_time: string | null
  load_out_start_time: string | null
  load_out_end_time: string | null
  provided_facilities: string[] | null
  photo_urls: string[] | null
  venue_features: string | null
  recruitment_purpose: string | null
  required_equipment: string | null
  notes: string | null
  status: 'draft' | 'open' | 'closed'
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface EventApplication {
  id: string
  offer_id: string
  organizer_user_id: string
  vendor_user_id: string
  vendor_profile_id: string | null
  vendor_business_name: string
  vendor_contact_name: string | null
  vendor_contact_email: string | null
  vendor_phone: string | null
  initial_message: string | null
  status: 'inquiry' | 'pending' | 'under_review' | 'accepted' | 'rejected'
  contact_released_at: string | null
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface ApplicationMessage {
  id: string
  application_id: string
  sender_user_id: string
  sender_role: 'vendor' | 'organizer'
  message: string
  read_by_vendor_at: string | null
  read_by_organizer_at: string | null
  created_at: string
}

// ---- API レスポンス型 ----

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface CsvUploadResult {
  inserted: number
  updated: number
  skipped: number
  newProducts: string[]   // 新規検出された商品名リスト
  errors: string[]
}
