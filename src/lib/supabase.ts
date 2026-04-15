import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Supabase env missing')
}

const resolvedSupabaseUrl = supabaseUrl
const resolvedSupabaseAnonKey = supabaseAnonKey

let browserClient: SupabaseClient<Database> | null = null

export function createServerSupabaseClient(accessToken?: string) {
  return createClient<Database>(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createBrowserSupabaseClient() {
  if (!browserClient) {
    browserClient = createClient<Database>(resolvedSupabaseUrl, resolvedSupabaseAnonKey)
  }

  return browserClient as SupabaseClient<Database>
}

export const supabase = createServerSupabaseClient()
