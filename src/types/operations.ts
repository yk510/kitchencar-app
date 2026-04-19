export type Location = {
  id: string
  name: string
  address: string
}

export type ManagedLocation = Location & {
  latitude: number | null
  longitude: number | null
  created_at: string
}

export type ProductMaster = {
  product_name: string
  cost_amount: number | null
  cost_rate: number | null
  cost_updated_at: string | null
}

export type UploadResultPayload = {
  inserted: number
  updated: number
  skipped: number
  newProducts: string[]
  errors: string[]
}

export type StallLogPayload = {
  stall_log: {
    id: string
    log_date: string
    location_id: string
    event_id: string | null
  }
  updated_transactions: number
  updated_product_sales: number
  event_id?: string | null
}

export type StallLogSummaryPayload = {
  unmatched_dates: string[]
  count: number
}

export type DraftDay = {
  id: string
  plan_date: string
  operation_type: 'open' | 'closed' | 'event'
  holiday_flag: string
  location_id: string | null
  location_name: string
  municipality: string
  event_name: string
  business_start_time: string
  business_end_time: string
  ai_source_text: string
  ai_confidence: string
  notes: string
  weather_type: string
  avg_temperature: string
}

export type PlansReferencePayload = {
  locations: Location[]
  eventNames: string[]
}

export type WeatherPreviewPayload = Array<{
  id: string
  weather_type: string | null
  avg_temperature: number | null
}>

export type PlansParsePayload = {
  draft: {
    title?: string | null
    plan_month?: string | null
    days?: Array<{
      date?: string | null
      operation_type?: 'open' | 'closed' | 'event'
      location_name?: string | null
      municipality?: string | null
      event_name?: string | null
      business_start_time?: string | null
      business_end_time?: string | null
      ai_source_text?: string | null
      ai_confidence?: number | null
      notes?: string | null
    }>
  }
}

export type PlansSavePayload = {
  plan_id: string
}

export type VendorDailyMemo = {
  id: string
  memo_date: string
  memo_text: string
  created_at: string
  updated_at: string
}

export type VendorWeeklyReport = {
  id: string
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

export type VendorDailySalesRow = {
  date: string
  weekday: string
  holidayFlag: string
  locationName: string
  eventName: string
  municipality: string
  weatherType: string
  avgTemperature: string
  sales: number
  txnCount: number
  avgTicket: number
  grossProfit: number
}

export type VendorWeekRange = {
  start: string
  end: string
  label: string
}
