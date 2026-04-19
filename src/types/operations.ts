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
