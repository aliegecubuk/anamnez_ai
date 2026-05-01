import { createClient } from '@supabase/supabase-js'

// NEVER import this file from client components or files with 'use client'
// ONLY use in: Server Components, Route Handlers, Server Actions
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
