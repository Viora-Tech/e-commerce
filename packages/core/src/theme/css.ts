import type { Theme } from './schema'
import { cssVarsToDeclarations, schemeVars, themeColorVars, themeLayoutVars } from './vars'

export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * CSS for a store's theme. Light tokens on :root; dark tokens under
 * [data-theme=dark] and, for the "system" state, prefers-color-scheme.
 * Every scheme also gets a .color-<id> class so a section can be dark on a light page.
 *
 * Every value comes from the same functions as `themeToCssVars`, which the admin's
 * live preview applies, so what the editor shows is what the storefront renders.
 */
export function themeToCss(theme: Theme): string {
  const light = cssVarsToDeclarations({
    ...themeLayoutVars(theme),
    ...themeColorVars(theme, 'light'),
  })
  const dark = cssVarsToDeclarations(themeColorVars(theme, 'dark'))

  // A section wearing a scheme paints itself with it (Glide's css-variables.liquid).
  const perScheme = theme.schemes
    .map(
      (s) =>
        `.color-${s.id}{${cssVarsToDeclarations(schemeVars(s))};background-color:var(--color-bg);color:var(--color-ink)}`,
    )
    .join('')
  // In dark mode a section wearing the light scheme swaps to the dark one, like the root.
  const darkScheme = theme.schemes.find((s) => s.id === theme.darkScheme)
  const swap =
    theme.darkMode.enabled && theme.lightScheme !== theme.darkScheme && darkScheme
      ? `.color-${theme.lightScheme}{${cssVarsToDeclarations(schemeVars(darkScheme))}}`
      : null
  // With dark mode off the "dark" vars are the light ones (a stale data-theme=dark
  // cookie must still read as light), and the page must not claim a dark scheme.
  const scheme = theme.darkMode.enabled ? 'dark' : 'light'
  return [
    `:root{${light};color-scheme:light}`,
    `:root[data-theme=dark]{${dark};color-scheme:${scheme}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${dark};color-scheme:${scheme}}}`,
    perScheme,
    swap ? `:root[data-theme=dark] ${swap}` : null,
    swap ? `@media (prefers-color-scheme:dark){:root:not([data-theme=light]) ${swap}}` : null,
  ]
    .filter((x): x is string => x !== null)
    .join('\n')
}
