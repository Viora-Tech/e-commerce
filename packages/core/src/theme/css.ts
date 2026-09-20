import type { ColorScheme, Theme } from './schema'

export type ThemeMode = 'light' | 'dark' | 'system'

const roles = (s: ColorScheme): string =>
  [
    `--color-bg:${s.background}`,
    `--color-ink:${s.text}`,
    `--color-muted:${s.textMuted}`,
    `--color-line:${s.line}`,
    `--color-surface:${s.surface}`,
    `--color-brand:${s.button}`,
    `--color-on-brand:${s.buttonText}`,
    `--color-accent:${s.accent}`,
    `--color-accent-2:${s.accent}`,
    // The always-dark band: a constant, not a derivation (see Glide's css-variables).
    `--color-dark-band:${s.text}`,
    `--color-on-dark-band:${s.background}`,
  ].join(';')

function scheme(theme: Theme, id: string): ColorScheme {
  const found = theme.schemes.find((s) => s.id === id) ?? theme.schemes[0]
  if (!found) throw new Error('theme has no schemes')
  return found
}

/**
 * CSS for a store's theme. Light tokens on :root; dark tokens under
 * [data-theme=dark] and, for the "system" state, prefers-color-scheme.
 * Every scheme also gets a .color-<id> class so a section can be dark on a light page.
 */
export function themeToCss(theme: Theme): string {
  const light = scheme(theme, theme.lightScheme)
  const dark = theme.darkMode.enabled ? scheme(theme, theme.darkScheme) : light
  const shared = [
    `--color-success:${theme.shared.success}`,
    `--color-danger:${theme.shared.danger}`,
    `--font-heading-scale:${theme.fonts.headingScale}`,
    `--font-body-size:${theme.fonts.bodySizePx}px`,
    `--section-radius:${theme.roundedSections ? 'clamp(16px, 1.578vw, 30px)' : '0px'}`,
  ].join(';')
  const perScheme = theme.schemes.map((s) => `.color-${s.id}{${roles(s)}}`).join('')
  return [
    `:root{${roles(light)};${shared};color-scheme:light}`,
    `:root[data-theme=dark]{${roles(dark)};color-scheme:dark}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${roles(dark)};color-scheme:dark}}`,
    perScheme,
  ].join('\n')
}
