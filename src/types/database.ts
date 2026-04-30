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
      vendor_daily_memos: {
        Row: VendorDailyMemo
        Insert: Omit<VendorDailyMemo, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VendorDailyMemo, 'id' | 'created_at'>>
      }
      vendor_weekly_reports: {
        Row: VendorWeeklyReport
        Insert: Omit<VendorWeeklyReport, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VendorWeeklyReport, 'id' | 'created_at'>>
      }
      vendor_stores: {
        Row: VendorStore
        Insert: Omit<VendorStore, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VendorStore, 'id' | 'created_at'>>
      }
      store_order_pages: {
        Row: StoreOrderPage
        Insert: Omit<StoreOrderPage, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StoreOrderPage, 'id' | 'created_at'>>
      }
      store_order_schedules: {
        Row: StoreOrderSchedule
        Insert: Omit<StoreOrderSchedule, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StoreOrderSchedule, 'id' | 'created_at'>>
      }
      store_order_schedule_inventories: {
        Row: StoreOrderScheduleInventory
        Insert: Omit<StoreOrderScheduleInventory, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StoreOrderScheduleInventory, 'id' | 'created_at'>>
      }
      mobile_order_products: {
        Row: MobileOrderProduct
        Insert: Omit<MobileOrderProduct, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrderProduct, 'id' | 'created_at'>>
      }
      mobile_order_option_groups: {
        Row: MobileOrderOptionGroup
        Insert: Omit<MobileOrderOptionGroup, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrderOptionGroup, 'id' | 'created_at'>>
      }
      mobile_order_option_choices: {
        Row: MobileOrderOptionChoice
        Insert: Omit<MobileOrderOptionChoice, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrderOptionChoice, 'id' | 'created_at'>>
      }
      mobile_order_product_option_groups: {
        Row: MobileOrderProductOptionGroup
        Insert: Omit<MobileOrderProductOptionGroup, 'id'>
        Update: Partial<Omit<MobileOrderProductOptionGroup, 'id'>>
      }
      mobile_orders: {
        Row: MobileOrder
        Insert: Omit<MobileOrder, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MobileOrder, 'id' | 'created_at'>>
      }
      mobile_order_items: {
        Row: MobileOrderItem
        Insert: Omit<MobileOrderItem, 'id' | 'created_at'>
        Update: never
      }
      mobile_order_item_option_choices: {
        Row: MobileOrderItemOptionChoice
        Insert: Omit<MobileOrderItemOptionChoice, 'id' | 'created_at'>
        Update: never
      }
      mobile_order_inventory_adjustments: {
        Row: MobileOrderInventoryAdjustment
        Insert: Omit<MobileOrderInventoryAdjustment, 'id' | 'created_at'>
        Update: never
      }
      mobile_order_notifications: {
        Row: MobileOrderNotification
        Insert: Omit<MobileOrderNotification, 'id' | 'created_at'>
        Update: Partial<Omit<MobileOrderNotification, 'id' | 'created_at'>>
      }
      mobile_order_audit_logs: {
        Row: MobileOrderAuditLog
        Insert: Omit<MobileOrderAuditLog, 'id' | 'created_at'>
        Update: never
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

export interface VendorDailyMemo {
  id: string
  user_id: string
  memo_date: string
  memo_text: string
  created_at: string
  updated_at: string
}

export interface VendorWeeklyReport {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  report_title: string
  weekly_summary: string
  ai_feedback: string
  source_note_count: number
  source_sales: number
  helpful_feedback: boolean | null
  helpful_marked_at: string | null
  created_at: string
  updated_at: string
}

export interface VendorStore {
  id: string
  vendor_user_id: string
  store_name: string
  slug: string
  store_code: string
  description: string | null
  hero_image_url: string | null
  is_mobile_order_enabled: boolean
  is_accepting_orders: boolean
  line_official_account_id: string | null
  created_at: string
  updated_at: string
}

export interface StoreOrderPage {
  id: string
  store_id: string
  page_title: string
  public_token: string
  status: 'draft' | 'published' | 'archived'
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StoreOrderSchedule {
  id: string
  store_id: string
  order_page_id: string
  business_date: string
  opens_at: string
  closes_at: string
  status: 'scheduled' | 'open' | 'closed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StoreOrderScheduleInventory {
  id: string
  schedule_id: string
  product_id: string
  initial_quantity: number
  created_at: string
  updated_at: string
}

export interface MobileOrderProduct {
  id: string
  store_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  sort_order: number
  tracks_inventory: boolean
  inventory_quantity: number | null
  low_stock_threshold: number
  is_published: boolean
  is_sold_out: boolean
  created_at: string
  updated_at: string
}

export interface MobileOrderOptionGroup {
  id: string
  store_id: string
  name: string
  is_required: boolean
  selection_type: 'single' | 'multiple'
  min_select: number | null
  max_select: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MobileOrderOptionChoice {
  id: string
  group_id: string
  name: string
  price_delta: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MobileOrderProductOptionGroup {
  id: string
  product_id: string
  option_group_id: string
  sort_order: number
}

export interface MobileOrder {
  id: string
  store_id: string
  order_page_id: string
  schedule_id: string
  order_number: string
  order_daily_sequence: number
  customer_line_user_id: string | null
  customer_line_display_name: string | null
  pickup_nickname: string
  status: 'placed' | 'preparing' | 'ready' | 'picked_up' | 'cancelled'
  payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded'
  payment_provider: string
  payment_reference: string | null
  subtotal_amount: number
  tax_amount: number
  total_amount: number
  ordered_at: string
  ready_notified_at: string | null
  picked_up_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface MobileOrderItem {
  id: string
  order_id: string
  product_id: string
  product_name_snapshot: string
  unit_price_snapshot: number
  quantity: number
  line_total_amount: number
  created_at: string
}

export interface MobileOrderItemOptionChoice {
  id: string
  order_item_id: string
  option_group_name_snapshot: string
  option_choice_name_snapshot: string
  price_delta_snapshot: number
  created_at: string
}

export interface MobileOrderInventoryAdjustment {
  id: string
  schedule_inventory_id: string
  schedule_id: string
  product_id: string
  adjustment_quantity: number
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface MobileOrderNotification {
  id: string
  order_id: string
  notification_type: 'order_completed' | 'order_preparing' | 'order_ready'
  delivery_status: string
  line_message_id: string | null
  sent_at: string | null
  failed_at: string | null
  error_message: string | null
  created_at: string
}

export interface MobileOrderAuditLog {
  id: string
  order_id: string
  actor_user_id: string | null
  action_type: string
  before_status: string | null
  after_status: string | null
  payload: Json | null
  created_at: string
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
  genre: string | null
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
