import { PLATFORM_BRANDING } from './defaults'
import { checkContrast, type ContrastFailure } from './contrast'
import { brandingOverrideSchema, type Branding } from './tokens'

/** Platform defaults overlaid with a community's overrides. Invalid stored data falls back to defaults. */
export function resolveBranding(stored: unknown): Branding {
  const parsed = brandingOverrideSchema.safeParse(stored ?? {})
  if (!parsed.success) return PLATFORM_BRANDING
  const o = parsed.data
  const merged: Branding = {
    ...PLATFORM_BRANDING,
    ...strip(o),
    colors: { ...PLATFORM_BRANDING.colors, ...o.colors },
    fonts: { ...PLATFORM_BRANDING.fonts, ...o.fonts },
    darkColors:
      o.darkColors === null
        ? null
        : { ...(PLATFORM_BRANDING.darkColors as NonNullable<Branding['darkColors']>), ...o.darkColors },
  }
  return validateContrast(merged).length ? PLATFORM_BRANDING : merged
}

/** Used by the brand settings screen: a save with any failing pair is blocked. */
export function validateContrast(b: Branding): ContrastFailure[] {
  return [...checkContrast(b.colors), ...(b.darkColors ? checkContrast(b.darkColors) : [])]
}

function strip<T extends Record<string, unknown>>(o: T) {
  const { colors: _c, darkColors: _d, fonts: _f, ...rest } = o
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
}
