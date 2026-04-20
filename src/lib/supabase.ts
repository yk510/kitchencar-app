import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getBrowserSupabaseStorageKey } from '@/lib/auth-cookie'
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

const browserClients = new Map<string, SupabaseClient<Database>>()

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
  const storageKey = getBrowserSupabaseStorageKey()
  const existingClient = browserClients.get(storageKey)

  if (existingClient) {
    return existingClient
  }

  const client = createClient<Database>(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
    auth: {
      storageKey,
    },
  })

  browserClients.set(storageKey, client)
  return client
}

export const supabase = createServerSupabaseClient()
