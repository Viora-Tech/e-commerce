import type { api } from '@/lib/api-client'

/** A theme as the library and editor receive it, with its own signed preview token. */
export type ThemeItem = Awaited<ReturnType<typeof api.themes.list>>[number]

/** The storefront URL that renders exactly this theme (Preview button, thumbnails). */
export const previewUrl = (origin: string, token: string, path = '/'): string =>
  `${origin}${path}?theme-preview=${encodeURIComponent(token)}`
