/** The affiliate portal's light or dark choice; absent follows the device. */
export const PORTAL_THEME_COOKIE = 'wc_portal_theme'

/** One year. */
export const PORTAL_THEME_MAX_AGE = 365 * 24 * 60 * 60

/** `dark` or `light` for a saved choice, null to follow the device. */
export function portalThemeClass(saved: string | undefined): 'dark' | 'light' | null {
  return saved === 'dark' || saved === 'light' ? saved : null
}

