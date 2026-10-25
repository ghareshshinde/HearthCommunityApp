import type { Branding } from './tokens'

/** Platform defaults: every community looks finished on day one. */
export const PLATFORM_BRANDING: Branding = {
  name: 'Hearth',
  shortName: 'Hearth',
  tagline: 'Where communities gather',
  logo: null, logoDark: null, mark: null, favicon: null,
  colors: {
    primary: '#9a3412', secondary: '#44403c', accent: '#b45309',
    background: '#fffbf5', surface: '#ffffff',
    textPrimary: '#1c1917', textSecondary: '#57534e', border: '#d6d3d1',
    success: '#166534', warning: '#92400e', error: '#b91c1c', link: '#1d4ed8',
  },
  darkColors: {
    primary: '#fdba74', secondary: '#d6d3d1', accent: '#fcd34d',
    background: '#1c1917', surface: '#292524',
    textPrimary: '#fafaf9', textSecondary: '#d6d3d1', border: '#57534e',
    success: '#86efac', warning: '#fcd34d', error: '#fca5a5', link: '#93c5fd',
  },
  fonts: { heading: 'Inter', body: 'Inter', indic: 'Noto Sans Devanagari, Noto Sans Gujarati' },
  baseSizePx: 16,
  radiusPx: 10,
  buttonStyle: 'filled',
  density: 'comfortable',
}
