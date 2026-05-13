import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { RecorderState } from '@/lib/sessions/types'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_STATES: RecorderState[] = ['idle', 'recording', 'paused', 'stopped', 'completed']

// Allowed transitions per the FSM in src/lib/sessions/types.ts.
// idle → recording (via POST /api/sessions, not this PATCH)
// recording → paused | stopped
// paused → recording | stopped | paused (idempotent — supports W-8 auto-pause race)
// stopped → completed
// completed is terminal.
const TRANSITIONS: Record<RecorderState, RecorderState[]> = {
  idle: ['recording'],
  recording: ['paused', 'stopped'],
  paused: ['recording', 'stopped', 'paused'],   // W-8: idempotent paused noop
  stopped: ['completed'],
  completed: [],
}

interface StatePatchBody {
  recorder_state?: RecorderState
  dropped_chunks_increment?: number    // W-2: client-side overflow telemetry
}

// PATCH /api/sessions/[id]/state
// Body: { recorder_state, dropped_chunks_increment? }
// Returns 200 { id, recorder_state, completed_at?, dropped_chunks }
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = (await req.json().catch(() => ({}))) as StatePatchBody
  const next = body.recorder_state as RecorderState | undefined
  if (!next || !VALID_STATES.includes(next)) {
    return NextResponse.json({ error: 'Geçersiz recorder_state.' }, { status: 422 })
  }

  // Validate dropped_chunks_increment if provided (W-2)
  let droppedIncrement = 0
  if (body.dropped_chunks_increment !== undefined) {
    if (
      typeof body.dropped_chunks_increment !== 'number' ||
      !Number.isInteger(body.dropped_chunks_increment) ||
      body.dropped_chunks_increment < 0 ||
      body.dropped_chunks_increment > 1000
    ) {
      return NextResponse.json(
        { error: 'dropped_chunks_increment 0 ile 1000 arasında bir tamsayı olmalı.' },
        { status: 422 },
      )
    }
    droppedIncrement = body.dropped_chunks_increment
  }

  // Read current state and confirm ownership.
  const { data: current } = await supabaseAdmin
    .from('sessions')
    .select('id, recorder_state, dropped_chunks')
    .eq('id', id)
    .eq('user_id', userId)
    .single<{ id: string; recorder_state: RecorderState; dropped_chunks: number }>()

  if (!current) {
    return NextResponse.json({ error: 'Seans bulunamadı.' }, { status: 404 })
  }

  // W-8: paused → paused is a noop on state but may still increment dropped_chunks.
  if (current.recorder_state === next && next === 'paused' && droppedIncrement === 0) {
    return NextResponse.json({
      id: current.id,
      recorder_state: current.recorder_state,
      dropped_chunks: current.dropped_chunks,
    })
  }

  if (!TRANSITIONS[current.recorder_state].includes(next)) {
    return NextResponse.json(
      { error: `Geçersiz durum geçişi: ${current.recorder_state} → ${next}` },
      { status: 409 },
    )
  }

  // When transitioning to 'completed', also stamp completed_at and status.
  const updates: Record<string, unknown> = { recorder_state: next }
  if (next === 'completed') {
    updates.completed_at = new Date().toISOString()
    updates.status = 'completed'
  }
  if (droppedIncrement > 0) {
    updates.dropped_chunks = current.dropped_chunks + droppedIncrement
  }

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, recorder_state, completed_at, status, dropped_chunks')
    .single()

  if (error || !data) {
    console.error('[sessions PATCH state]', { code: error?.code, message: error?.message })
    return NextResponse.json({ error: 'Durum güncellenemedi.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
