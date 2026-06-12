import { describe, it, expect } from 'vitest'
import { viewportSettingsSchema } from './schemas'

describe('viewportSettingsSchema', () => {
  const base = { width: 6, offset: 0, visible: true }

  it('accepts a valid positive width with a non-negative offset', () => {
    const result = viewportSettingsSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('accepts a zero offset (int<0, max> domain)', () => {
    expect(viewportSettingsSchema.safeParse({ ...base, offset: 0 }).success).toBe(true)
  })

  describe('width', () => {
    it.each([
      ['NaN', Number.NaN],
      ['negative', -1],
      ['zero', 0],
      ['fractional', 1.5],
    ])('rejects a %s width', (_label, width) => {
      expect(viewportSettingsSchema.safeParse({ ...base, width }).success).toBe(false)
    })
  })

  describe('offset', () => {
    it.each([
      ['NaN', Number.NaN],
      ['negative', -1],
      ['fractional', 1.5],
    ])('rejects a %s offset', (_label, offset) => {
      expect(viewportSettingsSchema.safeParse({ ...base, offset }).success).toBe(false)
    })
  })
})
