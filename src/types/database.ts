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
      weather_logs: {
        Row: WeatherLog
        Insert: Omit<WeatherLog, 'id' | 'created_at'>
        Update: Partial<Omit<WeatherLog, 'id' | 'created_at'>>
      }
    }
  }
}

// ---- エンティティ型 ----

export interface Location {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  event_name: string
  location_id: string | null
  created_at: string
}

export interface Transaction {
  id: string
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
  product_name: string
  cost_amount: number | null    // 原価額（円）
  cost_rate: number | null      // 原価率（%）
  cost_updated_at: string | null
  created_at: string
}

export interface CostHistory {
  id: string
  product_name: string
  cost_amount: number | null
  cost_rate: number | null
  changed_at: string
}

export interface ProductSale {
  id: string
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

export interface WeatherLog {
  id: string
  log_date: string
  location_id: string
  weather_type: '晴れ' | '曇り' | '雨' | '雪'
  weather_code: number | null
  temperature_max: number | null
  temperature_min: number | null
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
