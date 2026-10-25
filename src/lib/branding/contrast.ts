import type { ColorSet } from './tokens'

function channel(v: number) {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Foreground/background pairs that must meet WCAG AA (4.5:1 body text). */
const PAIRS: [keyof ColorSet, keyof ColorSet][] = [
  ['textPrimary', 'background'], ['textPrimary', 'surface'],
  ['textSecondary', 'background'], ['textSecondary', 'surface'],
  ['link', 'background'], ['link', 'surface'],
  ['error', 'surface'], ['success', 'surface'], ['warning', 'surface'],
  ['primary', 'background'],
]

export type ContrastFailure = { fg: string; bg: string; ratio: number }
export function checkContrast(c: ColorSet): ContrastFailure[] {
  return PAIRS.flatMap(([fg, bg]) => {
    const ratio = contrastRatio(c[fg], c[bg])
    return ratio < 4.5 ? [{ fg, bg, ratio: Math.round(ratio * 100) / 100 }] : []
  })
}
