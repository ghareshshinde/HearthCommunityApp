import { describe, expect, it } from 'vitest'
import { PLATFORM_BRANDING } from './defaults'
import { contrastRatio, checkContrast } from './contrast'
import { resolveBranding, validateContrast } from './resolve'
import { brandingToCss } from './css'

describe('branding', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
  it('platform defaults pass AA in light and dark', () => {
    expect(validateContrast(PLATFORM_BRANDING)).toEqual([])
  })
  it('a community override changes the output CSS without touching defaults', () => {
    const jsg = resolveBranding({ name: 'JSG Hyderabad', colors: { primary: '#0b3d91' } })
    expect(jsg.name).toBe('JSG Hyderabad')
    expect(brandingToCss(jsg)).toContain('--color-primary:#0b3d91')
    expect(brandingToCss(PLATFORM_BRANDING)).toContain('--color-primary:#9a3412')
  })
  it('blocks low-contrast pairs and falls back to defaults', () => {
    const bad = { colors: { textPrimary: '#eeeeee' } }
    expect(checkContrast({ ...PLATFORM_BRANDING.colors, ...bad.colors }).length).toBeGreaterThan(0)
    expect(resolveBranding(bad)).toBe(PLATFORM_BRANDING)
  })
  it('ignores malformed stored data', () => {
    expect(resolveBranding({ colors: { primary: 'red' } })).toBe(PLATFORM_BRANDING)
  })
  it('dark mode can be switched off', () => {
    expect(brandingToCss(resolveBranding({ darkColors: null }))).not.toContain('prefers-color-scheme')
  })
  it('strips unsafe characters from font names', () => {
    const css = brandingToCss(resolveBranding({ fonts: { heading: 'Evil;}body{x:y' } }))
    expect(css).not.toContain('}body{')
  })
})
