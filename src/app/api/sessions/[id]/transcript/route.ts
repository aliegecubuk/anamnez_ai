import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TranscriptSegmentDTO } from '@/lib/sessions/types'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/sessions/[id]/transcript
// Returns: TranscriptSegmentDTO[] ordered by sequence ASC
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sessionId } = await params

  // Confirm ownership.
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single<{ id: string }>()
  if (!session) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('transcript_segments')
    .select('sequence, content, started_at, ended_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('sequence', { ascending: true })

  if (error) {
    console.error('[transcript GET]', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Transkript okunamadı.' }, { status: 500 })
  }

  return NextResponse.json((data ?? []) as TranscriptSegmentDTO[])
}
