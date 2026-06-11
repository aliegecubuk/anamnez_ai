// Phase 5: Dental AI Açıklamaları — shared types (DESC-01..06)

export type DescriptionCategory = 'medication' | 'disease' | 'allergy'

// One describable term extracted from an anamnesis answer.
export interface DescribableTerm {
  term: string
  category: DescriptionCategory
}

// The 3-line dental description (DESC-03). disclaimer always appended server-side (DESC-06).
export interface DentalDescription {
  display_term: string
  category: DescriptionCategory
  dental_impact: string        // line 1: dental/surgical/anesthetic impact
  risk_level: string           // line 2: risk düzeyi
  precaution: string           // line 3: önerilen önlem
  active_ingredient: string | null  // DESC-04: set when resolved via active ingredient
  disclaimer: string           // always "Bu bilgi klinik karar desteği değildir"
}

// POST /api/descriptions request/response wire shapes.
export interface DescriptionRequest {
  term: string
  category: DescriptionCategory
}
export type DescriptionResponse = DentalDescription
