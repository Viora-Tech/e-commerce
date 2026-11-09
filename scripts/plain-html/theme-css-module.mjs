// Writes `apps/storefront/src/lib/plain-html/theme-compat.ts` from one or more CSS files written by
// `theme-css-extract.mjs` (one per theme analysed). Rules found for several themes are kept once,
// in the order first seen; the `@layer` order statement goes first.
//
//   node scripts/plain-html/theme-css-module.mjs waimers.css dawn.css
import { readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2)
const LAYERS = '@layer theme, base, components, utilities;'
const seen = new Set()
const rules = []
for (const file of files) {
  // One rule per line, except @keyframes, which run until a line that is just "}".
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    let rule = lines[i].trim()
    if (rule.startsWith('@keyframes')) {
      while (i + 1 < lines.length && lines[i].trim() !== '}') rule += lines[++i].trim()
    }
    if (!rule || rule === LAYERS || rule.startsWith('/*') || seen.has(rule)) continue
    seen.add(rule)
    rules.push(rule)
  }
}
const css = [LAYERS, ...rules].join('\n')
const out = new URL('../../apps/storefront/src/lib/plain-html/theme-compat.ts', import.meta.url)
writeFileSync(
  out,
  `/**
 * The few rules of our global stylesheet that imported themes rely on, for plain HTML pages
 * (\`render.ts\`), which do not load that stylesheet. On the React page our CSS loads before the
 * theme's, and some of its rules reach the theme's markup: Tailwind's preflight (border style,
 * link decoration, image alignment), our \`* { margin: 0 }\`, and Zero Drift block rules whose class
 * names the imported Zero Drift theme shares (kicker colour and capitals, the cookie banner's
 * entrance, the header menu pill, review cards...). Placed at the same spot (before the theme's
 * CSS) they cascade as before.
 *
 * Generated, do not edit by hand: \`scripts/plain-html/theme-css-reliance.mjs\` compares every
 * element's computed style with our sheets on and off on the live React pages, then
 * \`theme-css-extract.mjs\` keeps only the declarations behind each difference (with the custom
 * properties and keyframes they use) and \`theme-css-module.mjs\` writes this file. Regenerate when
 * the blocks CSS changes the look of imported themes. Analysed: ${files.map((f) => f.replace(/^.*[\\/]/, '')).join(', ')}.
 */
export const THEME_COMPAT_CSS = ${JSON.stringify(css)}
`,
)
console.log('rules', rules.length, 'bytes', css.length)
