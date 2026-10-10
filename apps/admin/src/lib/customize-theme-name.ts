/**
 * A theme's name as the editor's top bar shows it (Figma 369:4815: "Zero Drift", normal case).
 * Shopify themes often name themselves in capitals (`ZERO DRIFT (imported)`): a word written all
 * in capitals is shown capitalised, unless it is short enough to be an initialism (`GST`, `UI`).
 * Any other name is shown exactly as saved.
 */
const SHOUTED = /^[A-Z][A-Z0-9'’-]{3,}$/

export function displayThemeName(name: string): string {
  return name
    .split(/(\s+)/)
    .map((word) => {
      const core = word.replace(/^[("'“]+|[)"'”:,.!]+$/g, '')
      if (!SHOUTED.test(core)) return word
      const nice = `${core.charAt(0)}${core.slice(1).toLowerCase()}`
      return word.replace(core, nice)
    })
    .join('')
}
