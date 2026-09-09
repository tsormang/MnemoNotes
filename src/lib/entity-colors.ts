import type { EntityColorKey } from '../types/domain'

/** Named soft palettes shared by personnel, roles, calendar bubbles, and stats. */

export type { EntityColorKey }

export type EntityColors = {
  bg: string
  border: string
  text: string
}

export const ENTITY_COLOR_KEYS: EntityColorKey[] = [
  'blue',
  'green',
  'purple',
  'orange',
  'teal',
  'pink',
  'olive',
  'indigo',
]

export const DEFAULT_ENTITY_COLOR_KEY: EntityColorKey = 'blue'

export const ENTITY_COLOR_PALETTE: Record<EntityColorKey, EntityColors> = {
  blue: { bg: '#e8f1ff', border: '#3b82c4', text: '#1e4f8c' },
  green: { bg: '#e3f2e8', border: '#3d8b6a', text: '#1e5a42' },
  purple: { bg: '#f0e8f8', border: '#7b52ab', text: '#4a2878' },
  orange: { bg: '#fff0e6', border: '#d4783a', text: '#8c4518' },
  teal: { bg: '#e8f4f8', border: '#2a8fa8', text: '#1a5a6b' },
  pink: { bg: '#fce8f0', border: '#c45a8a', text: '#8c2848' },
  olive: { bg: '#f2f0e8', border: '#8a7a3a', text: '#5a4a18' },
  indigo: { bg: '#e8eef8', border: '#4a6ab8', text: '#2a4278' },
}

export function isEntityColorKey(value: string | null | undefined): value is EntityColorKey {
  return Boolean(value && value in ENTITY_COLOR_PALETTE)
}

export function resolveEntityColors(colorKey: string | null | undefined): EntityColors {
  if (isEntityColorKey(colorKey)) {
    return ENTITY_COLOR_PALETTE[colorKey]
  }
  return ENTITY_COLOR_PALETTE[DEFAULT_ENTITY_COLOR_KEY]
}

/** Stable hash for backfill / missing-key fallbacks. */
export function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

export function colorKeyFromId(id: string): EntityColorKey {
  return ENTITY_COLOR_KEYS[hashString(id) % ENTITY_COLOR_KEYS.length]
}

/**
 * Prefer unused palette keys in the org; when all are taken, pick any key at random.
 * Pass `random` for deterministic tests.
 */
export function pickRandomColorKey(
  usedKeys: Iterable<string>,
  random: () => number = Math.random,
): EntityColorKey {
  const used = new Set(
    [...usedKeys].filter((key): key is EntityColorKey => isEntityColorKey(key)),
  )
  const unused = ENTITY_COLOR_KEYS.filter((key) => !used.has(key))
  const pool = unused.length > 0 ? unused : ENTITY_COLOR_KEYS
  const index = Math.floor(random() * pool.length)
  return pool[Math.min(index, pool.length - 1)]
}

export function normalizeColorKey(
  value: string | null | undefined,
  fallbackId?: string,
): EntityColorKey {
  if (isEntityColorKey(value)) return value
  if (fallbackId) return colorKeyFromId(fallbackId)
  return DEFAULT_ENTITY_COLOR_KEY
}
