// Phase 6a: Periodontoloji Chartı types

export type PerioPoint = 'MB' | 'B' | 'DB' | 'ML' | 'L' | 'DL'
export const PERIO_POINTS: PerioPoint[] = ['MB', 'B', 'DB', 'ML', 'L', 'DL']
export const BUCCAL_POINTS: PerioPoint[] = ['MB', 'B', 'DB']
export const LINGUAL_POINTS: PerioPoint[] = ['ML', 'L', 'DL']

// FDI tooth quadrants — displayed left-to-right on screen
export const UPPER_RIGHT: readonly number[] = [18, 17, 16, 15, 14, 13, 12, 11]
export const UPPER_LEFT:  readonly number[] = [21, 22, 23, 24, 25, 26, 27, 28]
export const LOWER_LEFT:  readonly number[] = [31, 32, 33, 34, 35, 36, 37, 38]
export const LOWER_RIGHT: readonly number[] = [41, 42, 43, 44, 45, 46, 47, 48]
export const UPPER_TEETH: readonly number[] = [...UPPER_RIGHT, ...UPPER_LEFT]
export const LOWER_TEETH: readonly number[] = [...LOWER_RIGHT.slice().reverse(), ...LOWER_LEFT]
export const ALL_FDI_TEETH: Set<number> = new Set([
  ...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT,
])

export interface PerioPointValues {
  pocket_depth:    number | null
  attachment_loss: number | null
  bleeding:        boolean | null
}

// In-memory chart state: map from tooth_number → point → values
export type PerioChartState = Map<number, Map<PerioPoint, PerioPointValues>>

// DB row shapes
export interface PerioChartRow {
  id:         string
  user_id:    string
  session_id: string
  status:     'draft' | 'saved'
  saved_at:   string | null
  addendum:   string | null
  created_at: string
}

export interface PerioMeasurementRow {
  id:              string
  user_id:         string
  chart_id:        string
  tooth_number:    number
  point:           PerioPoint
  pocket_depth:    number | null
  attachment_loss: number | null
  bleeding:        boolean | null
  created_at:      string
}

// Wire shape for fetching full chart + measurements
export interface PerioChartDTO {
  id:         string
  session_id: string
  status:     'draft' | 'saved'
  saved_at:   string | null
  addendum:   string | null
  measurements: PerioMeasurementDTO[]
}

export interface PerioMeasurementDTO {
  tooth_number:    number
  point:           PerioPoint
  pocket_depth:    number | null
  attachment_loss: number | null
  bleeding:        boolean | null
}

// PATCH /api/sessions/[id]/perio/measurements body
export interface PerioPatchBody {
  tooth_number:    number
  point:           PerioPoint
  pocket_depth?:   number | null
  attachment_loss?: number | null
  bleeding?:        boolean | null
}

// GPT-4o parser output shapes
export interface ParsedPointValues {
  pocket_depth?:    number | null
  attachment_loss?: number | null
  bleeding?:        boolean | null
}

export interface ParsedToothEntry {
  tooth_number:  number
  confidence:    number        // 0..1
  ambiguous:     boolean
  candidates?:   number[]      // when ambiguous: possible FDI numbers
  raw_mention:   string        // original voice text for display
  measurements:  Partial<Record<PerioPoint, ParsedPointValues>>
}

export interface PerioParseResult {
  confirmed:    ParsedToothEntry[]   // apply directly (confidence >= 0.8, not ambiguous)
  ambiguous:    ParsedToothEntry[]   // show disambiguation modal
}

// Pathology types
export type PathologyCondition =
  | 'çürük'
  | 'diş_eti_çekilmesi'
  | 'dolgu'
  | 'kanal'
  | 'köprü'
  | 'eksik_diş'
  | 'diğer'

export const ALL_CONDITIONS: PathologyCondition[] = [
  'çürük', 'diş_eti_çekilmesi', 'dolgu', 'kanal', 'köprü', 'eksik_diş', 'diğer',
]

export const CONDITION_LABELS: Record<PathologyCondition, string> = {
  'çürük':             'Çürük',
  'diş_eti_çekilmesi': 'Diş Eti Çekilmesi',
  'dolgu':             'Dolgu',
  'kanal':             'Kanal',
  'köprü':             'Köprü',
  'eksik_diş':         'Eksik Diş',
  'diğer':             'Diğer',
}

export const CONDITION_COLORS: Record<PathologyCondition, string> = {
  'çürük':             '#ef4444',  // red
  'diş_eti_çekilmesi': '#f97316',  // orange
  'dolgu':             '#3b82f6',  // blue
  'kanal':             '#8b5cf6',  // purple
  'köprü':             '#06b6d4',  // cyan
  'eksik_diş':         '#6b7280',  // gray
  'diğer':             '#eab308',  // yellow
}

export interface ToothConditionRow {
  id:             string
  user_id:        string
  session_id:     string
  tooth_number:   number
  condition_type: PathologyCondition
  notes:          string | null
  created_at:     string
}

export interface ToothConditionDTO {
  id:             string
  tooth_number:   number
  condition_type: PathologyCondition
  notes:          string | null
}

// GPT-4o pathology parse output
export interface ParsedToothCondition {
  tooth_number:   number
  condition_type: PathologyCondition
  confidence:     number
  ambiguous:      boolean
  candidates?:    number[]
  raw_mention:    string
}

export interface PathologyParseResult {
  confirmed:  ParsedToothCondition[]
  ambiguous:  ParsedToothCondition[]
}
