import type { AppRole } from '@/lib/user-role'
import type { Database } from '@/types/database'
import type {
  ApplicationStatus,
  MarketplaceMessage,
  OrganizerApplicationRow,
  VendorApplicationRow,
} from '@/types/marketplace'
import type {
  ManagedLocation,
  PlansParsePayload,
  PlansReferencePayload,
  PlansSavePayload,
  ProductMaster,
  VendorDailyMemo,
  VendorDailySalesRow,
  VendorWeekRange,
  VendorWeeklyReport,
  WeatherPreviewPayload,
} from '@/types/operations'

export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']

export type UserProfilePayload = {
  profile: UserProfileRow | null
  role: AppRole
  email: string | null
}

export type UserProfileUpdatePayload = {
  profile: UserProfileRow
  role: AppRole
}

export type NotificationsUnreadCountPayload = {
  count: number
}

export type LocationUpsertPayload = {
  location: ManagedLocation
  geocoded: string | null
}

export type MutationSuccessPayload = {
  success: true
}

export type ProductMasterListPayload = ProductMaster[]

export type CrossAnalyticsDimensionKey =
  | 'location'
  | 'weekday'
  | 'weather'
  | 'hour'
  | 'product'

export type CrossAnalyticsMetricKey =
  | 'sales'
  | 'txn_count'
  | 'avg_ticket'
  | 'gross_profit'
  | 'gross_profit_rate'

export type CrossAnalyticsRow = {
  dimension_1: string
  dimension_2: string | null
  sales: number
  txn_count: number
  avg_ticket: number
  gross_profit: number
  gross_profit_rate: number
}

export type CrossAnalyticsPayload = {
  dimensions: CrossAnalyticsDimensionKey[]
  metrics: CrossAnalyticsMetricKey[]
  rows: CrossAnalyticsRow[]
}

export type EventApplicationRow = Database['public']['Tables']['event_applications']['Row']

export type OrganizerApplicationsPayload = OrganizerApplicationRow[]

export type VendorApplicationsPayload = VendorApplicationRow[]

export type ApplicationMessagesPayload = MarketplaceMessage[]

export type ApplicationMutationPayload = EventApplicationRow

export type ApplicationCreatePayload = EventApplicationRow

export type ApplicationSendMessagePayload = MarketplaceMessage

export type PlansReferenceApiPayload = PlansReferencePayload

export type PlansWeatherPreviewApiPayload = WeatherPreviewPayload

export type PlansParseApiPayload = PlansParsePayload

export type PlansSaveApiPayload = PlansSavePayload

export type PlanListDay = {
  id: string
  plan_date: string
  operation_type: 'open' | 'closed' | 'event'
  holiday_flag: string | null
  location_id: string | null
  location_name: string | null
  municipality: string | null
  event_name: string | null
  business_start_time: string | null
  business_end_time: string | null
  notes: string | null
}

export type PlanListItem = {
  id: string
  plan_month: string
  title: string | null
  source_image_name: string | null
  status: string
  created_at: string
  operation_plan_days: PlanListDay[] | null
}

export type PlansListPayload = PlanListItem[]

export type PlanForecastRunPayload = MutationSuccessPayload

export type VendorDailyMemoListPayload = VendorDailyMemo[]

export type VendorDailyMemoMutationPayload = VendorDailyMemo

export type VendorWeeklyReportListPayload = VendorWeeklyReport[]

export type VendorWeeklyReportGeneratePayload = VendorWeeklyReport

export type VendorWeeklyReportFeedbackPayload = VendorWeeklyReport

export type VendorDailyAnalyticsPagePayload = {
  rows: VendorDailySalesRow[]
  memos: VendorDailyMemo[]
  weeklyReports: VendorWeeklyReport[]
  weeks: VendorWeekRange[]
}

export type VendorStoreRow = Database['public']['Tables']['vendor_stores']['Row']
export type StoreOrderPageRow = Database['public']['Tables']['store_order_pages']['Row']
export type StoreOrderScheduleRow = Database['public']['Tables']['store_order_schedules']['Row']
export type StoreOrderScheduleInventoryRow = Database['public']['Tables']['store_order_schedule_inventories']['Row']
export type MobileOrderInventoryAdjustmentRow = Database['public']['Tables']['mobile_order_inventory_adjustments']['Row']
export type MobileOrderInventoryStatus = 'unmanaged' | 'not_set' | 'available' | 'low_stock' | 'sold_out'

export type VendorMobileOrderSchedulesPayload = {
  store: VendorStoreRow
  orderPage: StoreOrderPageRow
  schedules: StoreOrderScheduleRow[]
}

export type VendorMobileOrderScheduleMutationPayload = StoreOrderScheduleRow

export type MobileOrderProductRow = Database['public']['Tables']['mobile_order_products']['Row']

export type VendorMobileOrderProductsPayload = {
  store: VendorStoreRow
  currentSchedule: StoreOrderScheduleRow | null
  products: VendorMobileOrderManagedProduct[]
}

export type VendorMobileOrderProductMutationPayload = MobileOrderProductRow

export type VendorMobileOrderManagedProduct = MobileOrderProductRow & {
  current_schedule_inventory_id: string | null
  current_initial_quantity: number | null
  current_adjustment_total: number
  current_available_quantity: number | null
  current_ordered_quantity: number
  current_remaining_quantity: number | null
  current_inventory_status: MobileOrderInventoryStatus
  current_inventory_adjustments: MobileOrderInventoryAdjustmentRow[]
}

export type MobileOrderOptionGroupRow = Database['public']['Tables']['mobile_order_option_groups']['Row']
export type MobileOrderOptionChoiceRow = Database['public']['Tables']['mobile_order_option_choices']['Row']

export type VendorMobileOrderOptionGroup = MobileOrderOptionGroupRow & {
  choices: MobileOrderOptionChoiceRow[]
  linked_product_ids: string[]
}

export type VendorMobileOrderOptionsPayload = {
  store: VendorStoreRow
  products: MobileOrderProductRow[]
  optionGroups: VendorMobileOrderOptionGroup[]
}

export type VendorMobileOrderOptionGroupMutationPayload = VendorMobileOrderOptionGroup

export type PublicMobileOrderOptionChoice = MobileOrderOptionChoiceRow

export type PublicMobileOrderOptionGroup = MobileOrderOptionGroupRow & {
  choices: PublicMobileOrderOptionChoice[]
}

export type PublicMobileOrderProduct = MobileOrderProductRow & {
  option_groups: PublicMobileOrderOptionGroup[]
  current_schedule_inventory_id: string | null
  current_initial_quantity: number | null
  current_adjustment_total: number
  current_available_quantity: number | null
  current_ordered_quantity: number
  current_remaining_quantity: number | null
  current_inventory_status: MobileOrderInventoryStatus
}

export type PublicMobileOrderPagePayload = {
  store: VendorStoreRow
  orderPage: StoreOrderPageRow
  activeSchedule: StoreOrderScheduleRow | null
  nextSchedule: StoreOrderScheduleRow | null
  products: PublicMobileOrderProduct[]
}

export type PublicMobileOrderCreateItemPayload = {
  product_id: string
  quantity: number
  selected_option_choice_ids: string[]
}

export type PublicMobileOrderCreatePayload = {
  public_token: string
  pickup_nickname: string
  customer_line_user_id?: string | null
  customer_line_display_name?: string | null
  items: PublicMobileOrderCreateItemPayload[]
}

export type PublicMobileOrderCheckoutResponse = {
  order_id: string
  checkout_url: string
}

export type PublicMobileOrderCheckoutStatusResponse = {
  order_id: string
  order_number: string
  pickup_nickname: string
  total_amount: number
  ordered_at: string
  payment_status: MobileOrderRow['payment_status']
}

export type MobileOrderRow = Database['public']['Tables']['mobile_orders']['Row']
export type MobileOrderItemRow = Database['public']['Tables']['mobile_order_items']['Row']
export type MobileOrderItemOptionChoiceRow = Database['public']['Tables']['mobile_order_item_option_choices']['Row']
export type MobileOrderNotificationRow = Database['public']['Tables']['mobile_order_notifications']['Row']

export type VendorMobileOrderDashboardItem = MobileOrderItemRow & {
  mobile_order_item_option_choices: MobileOrderItemOptionChoiceRow[]
}

export type VendorMobileOrderDashboardOrder = MobileOrderRow & {
  mobile_order_items: VendorMobileOrderDashboardItem[]
  mobile_order_notifications: MobileOrderNotificationRow[]
}

export type VendorMobileOrderOrdersPayload = {
  store: VendorStoreRow
  schedules: StoreOrderScheduleRow[]
  selectedSchedule: StoreOrderScheduleRow | null
  orders: VendorMobileOrderDashboardOrder[]
}

export type VendorMobileOrderOrderMutationPayload = MobileOrderRow
