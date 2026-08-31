import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  isAppLocale,
  localeToBcp47,
  localeToFullCalendar,
  LOCALE_LABELS,
} from './types'

describe('i18n locale helpers', () => {
  it('defaults to Greek', () => {
    expect(DEFAULT_LOCALE).toBe('el')
  })

  it('recognizes supported locales', () => {
    expect(isAppLocale('el')).toBe(true)
    expect(isAppLocale('en')).toBe(true)
    expect(isAppLocale('fr')).toBe(false)
  })

  it('maps locale tags for document and FullCalendar', () => {
    expect(localeToBcp47('el')).toBe('el-GR')
    expect(localeToBcp47('en')).toBe('en-GB')
    expect(localeToFullCalendar('el')).toBe('el')
    expect(localeToFullCalendar('en')).toBe('en-gb')
  })

  it('exposes human-readable labels', () => {
    expect(LOCALE_LABELS.el).toBe('Ελληνικά')
    expect(LOCALE_LABELS.en).toBe('English')
  })
})
