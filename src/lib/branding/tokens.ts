import { z } from 'zod'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour')

export const colorSetSchema = z.object({
  primary: hex, secondary: hex, accent: hex, background: hex, surface: hex,
  textPrimary: hex, textSecondary: hex, border: hex,
  success: hex, warning: hex, error: hex, link: hex,
})
export type ColorSet = z.infer<typeof colorSetSchema>

export const brandingSchema = z.object({
  name: z.string().min(1).max(80),
  shortName: z.string().min(1).max(24),
  tagline: z.string().max(140),
  logo: z.string().nullable(),          // storage path or URL; null falls back to platform default
  logoDark: z.string().nullable(),
  mark: z.string().nullable(),
  favicon: z.string().nullable(),
  colors: colorSetSchema,
  darkColors: colorSetSchema.nullable(), // null = dark mode off
  fonts: z.object({ heading: z.string(), body: z.string(), indic: z.string() }),
  baseSizePx: z.number().min(14).max(20),
  radiusPx: z.number().min(0).max(24),
  buttonStyle: z.enum(['filled', 'outline']),
  density: z.enum(['compact', 'comfortable']),
})
export type Branding = z.infer<typeof brandingSchema>
/** What a community stores: any subset of overrides. */
export const brandingOverrideSchema = brandingSchema.partial().extend({
  colors: colorSetSchema.partial().optional(),
  darkColors: colorSetSchema.partial().nullable().optional(),
  fonts: brandingSchema.shape.fonts.partial().optional(),
})
export type BrandingOverride = z.infer<typeof brandingOverrideSchema>
