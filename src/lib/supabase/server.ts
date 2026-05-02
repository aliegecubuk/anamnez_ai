import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

export async function createSupabaseServerClient() {
  const { getToken } = await auth()

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
