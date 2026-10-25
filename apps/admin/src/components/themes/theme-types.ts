import type { api } from '@/lib/api-client'

/** A theme as the library and editor receive it, with its own signed preview token. */
export type ThemeItem = Awaited<ReturnType<typeof api.themes.list>>[number]

/** The storefront URL that renders exactly this theme (Preview button, thumbnails). */
export const previewUrl = (origin: string, token: string, path = '/'): string =>
  `${origin}${path}?theme-preview=${encodeURIComponent(token)}`

/** The theme's preview link opened on one saved version (Version history › Preview). */
export const versionPreviewUrl = (origin: string, token: string, batchId: string): string =>
  `${previewUrl(origin, token)}&theme-version=${encodeURIComponent(batchId)}`

/** "Last saved today, 6:08 pm by Asha", or without the name for themes saved before it was kept. */
export const savedLine = (
  copy: { lastSaved: (when: string) => string; savedBy: (saved: string, who: string) => string },
  when: string,
  by: string | null,
): string => (by ? copy.savedBy(copy.lastSaved(when), by) : copy.lastSaved(when))
