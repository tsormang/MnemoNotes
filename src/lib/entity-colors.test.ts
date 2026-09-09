import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENTITY_COLOR_KEY,
  ENTITY_COLOR_KEYS,
  ENTITY_COLOR_PALETTE,
  colorKeyFromId,
  isEntityColorKey,
  normalizeColorKey,
  pickRandomColorKey,
  resolveEntityColors,
} from './entity-colors'

describe('entity-colors', () => {
  it('resolves known keys to palette triples', () => {
    expect(resolveEntityColors('teal')).toEqual(ENTITY_COLOR_PALETTE.teal)
  })

  it('falls back to default for unknown keys', () => {
    expect(resolveEntityColors('neon')).toEqual(ENTITY_COLOR_PALETTE[DEFAULT_ENTITY_COLOR_KEY])
    expect(resolveEntityColors(null)).toEqual(ENTITY_COLOR_PALETTE[DEFAULT_ENTITY_COLOR_KEY])
  })

  it('validates color keys', () => {
    expect(isEntityColorKey('blue')).toBe(true)
    expect(isEntityColorKey('neon')).toBe(false)
  })

  it('derives a stable key from an id', () => {
    expect(colorKeyFromId('person-a')).toBe(colorKeyFromId('person-a'))
    expect(ENTITY_COLOR_KEYS).toContain(colorKeyFromId('person-a'))
  })

  it('prefers unused keys when picking randomly', () => {
    const used = ENTITY_COLOR_KEYS.slice(0, 7)
    const remaining = ENTITY_COLOR_KEYS[7]
    expect(pickRandomColorKey(used, () => 0)).toBe(remaining)
  })

  it('wraps to any key when the palette is exhausted', () => {
    expect(pickRandomColorKey(ENTITY_COLOR_KEYS, () => 0.99)).toBe(ENTITY_COLOR_KEYS[7])
  })

  it('normalizes invalid values with an id fallback', () => {
    expect(normalizeColorKey('blue')).toBe('blue')
    expect(normalizeColorKey('nope', 'person-a')).toBe(colorKeyFromId('person-a'))
    expect(normalizeColorKey(undefined)).toBe(DEFAULT_ENTITY_COLOR_KEY)
  })
})
