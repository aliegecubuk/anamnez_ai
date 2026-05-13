import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// After the guard above, these are guaranteed non-undefined.
const _supabaseUrl = supabaseUrl as string
const _supabaseAnonKey = supabaseAnonKey as string

export async function createSupabaseServerClient() {
  const { getToken } = await auth()

  return createClient(
    _supabaseUrl,
    _supabaseAnonKey,
    {
      global: {
        fetch: async (url, options = {}) => {
          const clerkToken = await getToken()
          if (!clerkToken) {
            throw new Error('No Clerk session token — user is not authenticated')
          }
          const headers = new Headers(options?.headers)
          headers.set('Authorization', `Bearer ${clerkToken}`)
          return fetch(url, { ...options, headers })
        },
      },
    }
  )
}
