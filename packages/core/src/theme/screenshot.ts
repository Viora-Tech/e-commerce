/** SOURCE OF TRUTH: theme screenshots — WHAT: the worker queue that photographs a theme's home page in a headless browser after Publish and Save, and where the picture is stored (one webp per theme) / WHY: the browser capture in Customize cannot paint an imported (Liquid) theme, so the Themes page showed a blank live theme (#123) */
import type { StorageProvider } from '@commerce/storage'

export const THEME_SCREENSHOT_QUEUE = '{themes}-screenshot'

export type ThemeScreenshotJob = { storeId: string; themeId: string }

/** The slice of a BullMQ queue the admin needs to ask for a screenshot. */
export type ThemeScreenshotQueue = {
  add(
    name: string,
    data: ThemeScreenshotJob,
    opts?: {
      jobId?: string
      delay?: number
      attempts?: number
      removeOnComplete?: boolean
      removeOnFail?: boolean
    },
  ): Promise<unknown>
}

/**
 * Waits this long before the shot: the request's transaction has committed and the storefront
 * has dropped its cached page by then. Saves inside the window share one job (same `jobId`).
 */
export const THEME_SCREENSHOT_DELAY_MS = 20_000

/**
 * Asks the worker to photograph a theme. Never fails the caller: a lost picture leaves the
 * previous one (or the placeholder) on the Themes page.
 */
export async function queueThemeScreenshot(
  queue: ThemeScreenshotQueue | undefined,
  job: ThemeScreenshotJob,
): Promise<void> {
  if (!queue) return
  try {
    await queue.add('screenshot', job, {
      jobId: `theme-shot:${job.themeId}`,
      delay: THEME_SCREENSHOT_DELAY_MS,
      attempts: 2,
      removeOnComplete: true,
      removeOnFail: true,
    })
  } catch {
    // Redis unavailable: the theme keeps its last picture.
  }
}

/** The object key of a theme's picture: one per theme, under the store's folder. */
export const themeThumbnailKey = (storeId: string, themeId: string): string =>
  `stores/${storeId}/themes/${themeId}/thumbnail.webp`

/** Writes the picture and resolves the URL to store, versioned by `now` so caches refresh. */
export async function uploadThemeThumbnail(
  storage: Pick<StorageProvider, 'put' | 'publicUrl'>,
  input: { storeId: string; themeId: string; bytes: Uint8Array; now?: Date },
): Promise<string> {
  const key = themeThumbnailKey(input.storeId, input.themeId)
  await storage.put({ key, body: input.bytes, contentType: 'image/webp' })
  const url = storage.publicUrl(key)
  return `${url}${url.includes('?') ? '&' : '?'}v=${(input.now ?? new Date()).getTime()}`
}
