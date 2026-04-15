import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// 環境変数取得（両対応）
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY

// 🔍 デバッグログ（必須）
console.log('SUPABASE URL:', supabaseUrl)
console.log('SUPABASE KEY exists:', !!supabaseAnonKey)

// ❗未設定なら即落とす
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Supabase env missing')
}

// クライアント生成
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)