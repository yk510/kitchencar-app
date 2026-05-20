import type { AppRole } from '@/lib/user-role'
import type { StoreOrderScheduleWithContext } from '@/lib/store-order-schedule-metadata'
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

export type UserProfileSummaryPayload = {
  hasProfile: boolean
  role: AppRole | null
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

export type ProductMasterLinkMode = 'dedicated' | 'matched_existing'

export type ProductMasterRecordPayload = ProductMaster

export type ProductMasterMobileOrderLinkPayload = {
  mobile_order_product_id: string
  mobile_order_product_name: string
  mobile_order_product_price: number
  linked_product_master_id: string | null
  linked_product_master_name: string | null
  link_mode: ProductMasterLinkMode | null
  cost_amount: number | null
  cost_rate: number | null
  cost_updated_at: string | null
}

export type ProductMasterMobileOrderOptionChoiceLinkPayload = {
  mobile_order_option_choice_id: string
  mobile_order_option_choice_name: string
  mobile_order_option_choice_price_delta: number
  mobile_order_option_group_name: string
  linked_product_master_id: string | null
  linked_product_master_name: string | null
  link_mode: ProductMasterLinkMode | null
  cost_amount: number | null
  cost_rate: number | null
  cost_updated_at: string | null
}

export type ProductMasterListPayload = {
  mobile_order_products: ProductMasterMobileOrderLinkPayload[]
  mobile_order_option_choices: ProductMasterMobileOrderOptionChoiceLinkPayload[]
  standalone_products: ProductMasterRecordPayload[]
  all_product_masters: ProductMasterRecordPayload[]
}

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
export type MobileOrderInventoryStatus =
  | 'loading'
  | 'unmanaged'
  | 'not_set'
  | 'available'
  | 'low_stock'
  | 'sold_out'
export type MobileOrderSource = Database['public']['Tables']['mobile_orders']['Row']['order_source']
export type MobileOrderPaymentStatus = Database['public']['Tables']['mobile_orders']['Row']['payment_status']
export type MobileOrderPaymentMethod = NonNullable<
  Database['public']['Tables']['mobile_orders']['Row']['payment_method']
>
export type StorePosPaymentMethod = Exclude<MobileOrderPaymentMethod, 'card_online'>
export type ReceiptPrinterProvider = NonNullable<
  Database['public']['Tables']['vendor_stores']['Row']['receipt_printer_provider']
>
export type ReceiptPrintMode = NonNullable<
  Database['public']['Tables']['vendor_stores']['Row']['receipt_print_mode']
>
export type NativeReceiptBridgeMode = 'ios_helper_app' | 'ios_webview_wrapper'
export type NativeReceiptPrintIntent = 'auto_print' | 'reprint' | 'probe'
export type NativeReceiptPrintOrigin = 'vendor_mobile_order_orders' | 'store_pos' | 'vendor_mobile_order_settings'

export type VendorLocationOption = {
  id: string
  name: string
  address: string
}

export type VendorMobileOrderSchedulesPayload = {
  store: VendorStoreRow
  orderPage: StoreOrderPageRow
  schedules: StoreOrderScheduleWithContext[]
  locations: VendorLocationOption[]
}

export type VendorMobileOrderScheduleMutationPayload = StoreOrderScheduleRow

export type VendorStorePosSettingsUpdatePayload = {
  is_store_pos_enabled: boolean
  store_pos_terminal_name: string | null
  store_pos_enabled_payment_methods: StorePosPaymentMethod[]
}

export type VendorReceiptPrintSettingsUpdatePayload = {
  is_receipt_print_enabled: boolean
  receipt_printer_provider: ReceiptPrinterProvider | null
  receipt_printer_endpoint: string | null
  receipt_printer_label: string | null
  receipt_print_mode: ReceiptPrintMode | null
}

export type VendorMobileOrderSettingsUpdatePayload =
  Partial<VendorStorePosSettingsUpdatePayload & VendorReceiptPrintSettingsUpdatePayload>

export type VendorMobileOrderSettingsPayload = {
  store: VendorStoreRow
  orderPage: StoreOrderPageRow
  persistence: 'hybrid' | 'notes_fallback'
}

export type VendorReceiptPrintProbePayload = {
  printer_provider: ReceiptPrinterProvider
  printer_endpoint: string
  printer_label: string | null
  result: VendorMobileOrderPrintResultPayload['result']
}

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
  inventoryHydrated: boolean
}

export type PublicMobileOrderInventorySnapshot = {
  activeSchedule: StoreOrderScheduleRow | null
  nextSchedule: StoreOrderScheduleRow | null
  products: Array<
    Pick<
      PublicMobileOrderProduct,
      | 'id'
      | 'current_schedule_inventory_id'
      | 'current_initial_quantity'
      | 'current_adjustment_total'
      | 'current_available_quantity'
      | 'current_ordered_quantity'
      | 'current_remaining_quantity'
      | 'current_inventory_status'
    >
  >
  inventoryHydrated: true
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

export type StorePosCreatePayload = {
  public_token: string
  pickup_nickname: string
  payment_method: StorePosPaymentMethod
  pos_device_label?: string | null
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

export type PublicStorePosOrderStatusResponse = {
  order_id: string
  order_number: string
  total_amount: number
  payment_status: MobileOrderRow['payment_status']
  status: MobileOrderRow['status']
  paid_at: string | null
  cancelled_at: string | null
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

export type VendorMobileOrderListItem = MobileOrderRow & {
  item_count: number
}

export type StorePosPaymentReceiptPayload = {
  order_id: string
  payment_status: Extract<MobileOrderPaymentStatus, 'paid'>
  paid_at: string
}

export type VendorMobileOrderOrdersPayload = {
  store: VendorStoreRow
  schedules: StoreOrderScheduleRow[]
  selectedSchedule: StoreOrderScheduleRow | null
  counts: {
    placed: number
    preparing: number
    ready: number
    picked_up: number
    total: number
  }
  orders: VendorMobileOrderListItem[]
}

export type VendorMobileOrderOrdersSummaryPayload = VendorMobileOrderOrdersPayload['counts']

export type VendorMobileOrderOrdersListPayload = {
  orders: VendorMobileOrderListItem[]
}

export type VendorMobileOrderOrderDetailPayload = {
  order: VendorMobileOrderDashboardOrder | null
}

export type ReceiptPrintLinePayload = {
  order_item_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total_amount: number
  options: Array<{
    option_group_name: string
    option_choice_name: string
    price_delta: number
  }>
}

export type ReceiptPrintPayload = {
  order_id: string
  order_source: MobileOrderSource
  header: {
    label: '注文番号'
    value: string
    badge_label: string | null
  }
  body: {
    label: '注文内容'
    items: ReceiptPrintLinePayload[]
    item_count: number
    total_quantity: number
  }
  footer: {
    store_name: string
    ordered_at: string
    ordered_at_label: string
  }
}

export type NativeReceiptPrintRequest = {
  kind: 'receipt_print'
  bridge_version: 1
  mode: NativeReceiptBridgeMode
  intent: NativeReceiptPrintIntent
  origin: NativeReceiptPrintOrigin
  request_id: string
  created_at: string
  payload: ReceiptPrintPayload
  plain_text: string
  printer_hint: {
    vendor: 'sii_mp_b20'
    connection: 'bluetooth'
  }
  callback: {
    event_name: 'kuridas:native-receipt-print'
    callback_url: string | null
  }
}

export type NativeReceiptBridgeCallbackPayload = {
  kind: 'receipt_print_result'
  bridge_version: 1
  request_id: string
  status: 'accepted' | 'printed' | 'failed' | 'unsupported'
  printer_vendor: 'sii_mp_b20'
  printer_connection: 'bluetooth'
  error_code: string | null
  error_message: string | null
  printed_at: string | null
}

export type VendorMobileOrderReceiptPrintStatusPayload = {
  attempted: boolean
  printed: boolean
  is_reprint: boolean
  error_message: string | null
  result: VendorMobileOrderPrintResultPayload['result'] | null
  delivery: 'server_print' | 'native_bridge' | null
  native_request: NativeReceiptPrintRequest | null
}

export type VendorMobileOrderPrintResultPayload = {
  order_id: string
  order_number: string
  is_reprint: boolean
  printer_provider: ReceiptPrinterProvider
  printer_endpoint: string
  printer_label: string | null
  print_mode: ReceiptPrintMode | null
  delivery: 'server_print'
  result: {
    endpoint: string
    http_status: number
    printer_success: boolean
    printer_code: string | null
    response_text: string
  }
}

export type VendorMobileOrderNativePrintDispatchPayload = {
  order_id: string
  order_number: string
  is_reprint: boolean
  printer_provider: 'ios_webview_wrapper'
  printer_endpoint: string
  printer_label: string | null
  print_mode: ReceiptPrintMode | null
  delivery: 'native_bridge'
  native_request: NativeReceiptPrintRequest
}

export type VendorMobileOrderPrintDispatchPayload =
  | VendorMobileOrderPrintResultPayload
  | VendorMobileOrderNativePrintDispatchPayload

export type VendorMobileOrderOrderMutationPayload = MobileOrderRow & {
  receipt_print?: VendorMobileOrderReceiptPrintStatusPayload
}
