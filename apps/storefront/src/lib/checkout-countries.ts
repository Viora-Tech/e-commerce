/*
 * The checkout's Country picker: each code with its English name, India first, the rest by
 * name. Names come from the runtime (`Intl.DisplayNames`), so no list ships with the page.
 */

let regionNames: Intl.DisplayNames | null = null

/** "AU" → "Australia"; the code itself when the runtime has no name for it. */
export function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

/** `[code, name]` pairs for the select, India first. */
export function countryOptions(codes: readonly string[]): (readonly [string, string])[] {
  const named = codes.map((c) => [c, countryName(c)] as const)
  const home = named.filter(([c]) => c === 'IN')
  const rest = named.filter(([c]) => c !== 'IN').sort((a, b) => a[1].localeCompare(b[1]))
  return [...home, ...rest]
}
