/**
 * Fonts an imported theme names but never loads itself. On the React page our self-hosted
 * next/font faces (`lib/fonts.ts`) are in the global stylesheet, so a theme whose CSS says
 * `font-family: 'Plus Jakarta Sans'` (Waimers' Zero Drift does, in an inline `:root` style) is
 * drawn in it although the theme never declares the face. The plain page has no global
 * stylesheet, so for each of our families the page's markup names it links the same family from
 * Google Fonts with the same weights. Also when the theme's own font link asks for that family:
 * the theme usually asks for fewer weights (Waimers: Figtree 500 and 800 only) and the React page
 * had all of ours, so text set at 400 or 600 would otherwise be drawn from a neighbouring weight.
 * Pure.
 */

/** Our next/font families (`lib/fonts.ts`) and their Google Fonts `css2` axes, as self-hosted. */
const FAMILIES: Record<string, string> = {
  Archivo: 'wght@400;500;600;700',
  Figtree: 'ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700',
  Inter: 'wght@100..900',
  Manrope: 'wght@200..800',
  'DM Sans': 'wght@100..1000',
  Geist: 'wght@100..900',
  'Plus Jakarta Sans': 'wght@200..800',
  'Space Grotesk': 'wght@300..700',
  Sora: 'wght@100..800',
  Outfit: 'wght@100..900',
  Lexend: 'wght@100..900',
  'Work Sans': 'wght@100..900',
  'IBM Plex Sans': 'wght@400;500;600;700',
  'Playfair Display': 'wght@400..900',
  Fraunces: 'wght@100..900',
  Lora: 'wght@400..700',
  'Instrument Serif': 'wght@400',
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Our families named in a `font-family` or `--font…` declaration of `html`. */
export function namedFamilies(html: string): string[] {
  const declarations = html.match(/(?:font-family|--font[\w-]*)\s*:[^;}<]*/gi) ?? []
  const text = declarations.join('\n')
  return Object.keys(FAMILIES).filter((family) =>
    new RegExp(`(^|[\\s,:'"])${escapeRe(family)}(['"]|\\s*[,;]|\\s*$)`, 'im').test(text),
  )
}

/** The Google Fonts stylesheet for our families the page names; null when there are none. */
export function ourFontsHref(html: string): string | null {
  const named = namedFamilies(html)
  if (!named.length) return null
  const query = named.map((f) => `family=${f.replace(/ /g, '+')}:${FAMILIES[f]}`).join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
