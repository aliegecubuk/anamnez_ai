import { describe, it, expect } from 'vitest'
import { DESCRIPTION_SCHEMA } from './schema'

describe('DESCRIPTION_SCHEMA', () => {
  it('has name "dental_description"', () => {
    expect(DESCRIPTION_SCHEMA.name).toBe('dental_description')
  })
  it('strict is true', () => {
    expect(DESCRIPTION_SCHEMA.strict).toBe(true)
  })
  it('has exactly 3 properties', () => {
    const props = Object.keys(DESCRIPTION_SCHEMA.schema.properties as object)
    expect(props).toHaveLength(3)
    expect(props).toContain('dental_impact')
    expect(props).toContain('risk_level')
    expect(props).toContain('precaution')
  })
  it('all properties are type string', () => {
    const props = DESCRIPTION_SCHEMA.schema.properties as Record<string, { type: string }>
    for (const key of ['dental_impact', 'risk_level', 'precaution']) {
      expect(props[key].type).toBe('string')
    }
  })
  it('required lists all 3 fields', () => {
    const required = DESCRIPTION_SCHEMA.schema.required as string[]
    expect(required).toHaveLength(3)
    expect(required).toContain('dental_impact')
    expect(required).toContain('risk_level')
    expect(required).toContain('precaution')
  })
  it('additionalProperties is false', () => {
    expect(DESCRIPTION_SCHEMA.schema.additionalProperties).toBe(false)
  })
  it('does NOT contain a disclaimer property', () => {
    const props = DESCRIPTION_SCHEMA.schema.properties as object
    expect(Object.keys(props)).not.toContain('disclaimer')
  })
})
