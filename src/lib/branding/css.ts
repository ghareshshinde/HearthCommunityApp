import type { Branding, ColorSet } from './tokens'

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
const vars = (c: ColorSet) => Object.entries(c).map(([k, v]) => `--color-${kebab(k)}:${v}`).join(';')
const safeFont = (f: string) => f.replace(/[^\w\s,-]/g, '')

/** Design tokens as CSS variables, applied at request time so a rebrand needs no deploy. */
export function brandingToCss(b: Branding): string {
  const root =
    `:root{${vars(b.colors)};--font-heading:${safeFont(b.fonts.heading)},${safeFont(b.fonts.indic)},sans-serif;` +
    `--font-body:${safeFont(b.fonts.body)},${safeFont(b.fonts.indic)},sans-serif;--base-size:${b.baseSizePx}px;` +
    `--radius:${b.radiusPx}px;--space:${b.density === 'compact' ? 0.75 : 1}rem}`
  if (!b.darkColors) return root
  const dark = vars(b.darkColors)
  return `${root}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}:root[data-theme="dark"]{${dark}}`
}
