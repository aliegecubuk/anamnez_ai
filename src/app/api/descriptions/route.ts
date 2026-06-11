import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateDentalDescription, DentalDescriptionError } from '@/lib/openai/descriptions'
import { normalizeTerm } from '@/lib/descriptions/classifier'
import type { DescriptionCategory, DentalDescription } from '@/lib/descriptions/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// DESC-06: disclaimer appended server-side on every response path — never model-generated.
const DISCLAIMER = 'Bu bilgi klinik karar desteği değildir' as const

const VALID_CATEGORIES = new Set<DescriptionCategory>(['medication', 'disease', 'allergy'])

// POST /api/descriptions — validate, cache-read, generate on miss, cache-write, return.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { term?: unknown; category?: unknown }
  const term = typeof body.term === 'string' ? body.term.trim() : ''
  const category = body.category as DescriptionCategory | undefined

  if (!term) {
    return NextResponse.json({ error: 'Terim zorunludur.' }, { status: 422 })
  }
  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Geçersiz kategori.' }, { status: 422 })
  }

  const term_key = normalizeTerm(term)

  // CACHE READ — per-user, per-term, per-category (T-05-05).
  const { data: cached } = await supabaseAdmin
    .from('dental_descriptions')
    .select('display_term, category, dental_impact, risk_level, precaution, active_ingredient')
    .eq('user_id', userId)
    .eq('term_key', term_key)
    .eq('category', category)
    .maybeSingle<{
      display_term: string
      category: DescriptionCategory
      dental_impact: string
      risk_level: string
      precaution: string
      active_ingredient: string | null
    }>()

  if (cached) {
    const response: DentalDescription = {
      display_term: cached.display_term,
      category: cached.category,
      dental_impact: cached.dental_impact,
      risk_level: cached.risk_level,
      precaution: cached.precaution,
      active_ingredient: cached.active_ingredient,
      disclaimer: DISCLAIMER,
    }
    return NextResponse.json(response)
  }

  // CACHE MISS — call GPT-4o.
  let generated
  try {
    generated = await generateDentalDescription(term, category)
  } catch (err) {
    if (err instanceof DentalDescriptionError) {
      console.error('[descriptions POST]', { code: err.code, message: err.message })
      return NextResponse.json({ error: 'Açıklama üretilemedi.' }, { status: 502 })
    }
    throw err
  }

  // CACHE WRITE — non-fatal; description still returned on write failure (T-05-07).
  const { error: writeError } = await supabaseAdmin
    .from('dental_descriptions')
    .upsert(
      {
        user_id: userId,
        term_key,
        category,
        display_term: term,
        dental_impact: generated.dental_impact,
        risk_level: generated.risk_level,
        precaution: generated.precaution,
        active_ingredient: generated.active_ingredient,
      },
      { onConflict: 'user_id,term_key,category' },
    )

  if (writeError) {
    console.error('[descriptions POST cache write]', {
      code: writeError.code,
      message: writeError.message,
    })
  }

  const response: DentalDescription = {
    display_term: term,
    category,
    dental_impact: generated.dental_impact,
    risk_level: generated.risk_level,
    precaution: generated.precaution,
    active_ingredient: generated.active_ingredient,
    disclaimer: DISCLAIMER,
  }
  return NextResponse.json(response)
}
