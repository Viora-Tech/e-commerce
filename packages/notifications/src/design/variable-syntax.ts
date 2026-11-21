/** The `{{name}}` syntax of design variables; pure, so the admin's editor can use it too. */

/** `{{ name }}` with optional spaces; names are lower snake case. */
export const VAR = /\{\{\s*([a-z_]+)\s*\}\}/g

/** Every `{{name}}` in a text that this template cannot fill, once each. */
export function unknownVariables(text: string, allowed: readonly string[]): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(VAR)) {
    const name = m[1] ?? ''
    if (!allowed.includes(name)) out.add(name)
  }
  return [...out]
}

/** Stand-in values for checking a link that uses variables (`{{shop_url}}/sale`). */
export function fillForCheck(text: string): string {
  return text.replace(VAR, (_w, name: string) =>
    name.endsWith('_url') ? 'https://example.com' : 'x',
  )
}
