import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return new Response('Server misconfiguration', { status: 500 })
  }

  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: { type: string; data: Record<string, unknown> }
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as { type: string; data: Record<string, unknown> }
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  if (evt.type === 'session.created') {
    const data = evt.data
    const user_id = data.user_id as string
    const session_id = data.id as string
    const clerk_org_id = (data.last_active_organization_id as string) ?? null

    // Extract client IP from Clerk event payload (x-forwarded-for is Svix's IP, not the user's)
    const ip_address =
      (data.request_data as Record<string, unknown>)?.remote_addr as string ?? null

    const { error } = await supabaseAdmin.from('login_audit_log').insert({
      user_id,
      session_id,
      clerk_org_id,
      ip_address,
      user_agent: headerPayload.get('user-agent') ?? null,
      logged_in_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Failed to write audit log:', error)
      // Return 200 anyway — Clerk will retry on 5xx but audit log failure should not block login
      return new Response('Audit log write failed', { status: 200 })
    }
  }

  return new Response('OK', { status: 200 })
}
