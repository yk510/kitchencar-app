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
