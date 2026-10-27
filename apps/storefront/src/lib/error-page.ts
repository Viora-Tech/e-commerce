/**
 * Shared pieces of the storefront's error pages (`components/errors/error-screen.tsx`, the bare
 * `app/not-found.tsx`).
 */

/**
 * The checkout palette's branding properties before the store's own arrive (or when they cannot
 * be read): ink buttons on the page colour, so light and dark both read. `.ck` in globals.css
 * holds the rest of the palette.
 */
export const CK_FALLBACK_VARS: Record<string, string> = {
  '--ck-accent': 'var(--ck-ink)',
  '--ck-accent-ink': 'var(--ck-bg)',
  '--ck-button': 'var(--ck-ink)',
  '--ck-button-ink': 'var(--ck-bg)',
  '--ck-radius': '0.75rem',
  '--ck-radius-button': '0.75rem',
  '--ck-font': 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}

/**
 * The error card's entrance: a fade and an 8px rise over 240ms on the strong ease-out
 * (`sf-rise`, globals.css); with reduced motion only the fade. Plays once when the card mounts.
 */
export const ERROR_ENTER =
  'motion-safe:animate-[sf-rise_240ms_var(--ease-out)_both] motion-reduce:animate-[sf-fade_200ms_var(--ease-out)_both]'

/** The error's digest (the id in the server logs), when the thrown value carries one. */
export function errorDigest(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('digest' in error)) return null
  return typeof error.digest === 'string' && error.digest ? error.digest : null
}
