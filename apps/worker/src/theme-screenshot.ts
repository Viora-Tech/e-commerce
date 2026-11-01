import {
  getTheme,
  setThemeThumbnail,
  signThemePreviewToken,
  storageForStore,
  storefrontOriginFor,
  THEME_SCREENSHOT_QUEUE,
  type ThemeScreenshotJob,
  uploadThemeThumbnail,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

/** The desktop frame the Themes page draws the picture in (1440 × 1080). */
const VIEWPORT = { width: 1440, height: 1080 }
/** Stored width: sharp on a retina admin screen, still a small webp. */
const STORED_WIDTH = 960
/** A page that never settles still gets photographed after this. */
const NAVIGATION_TIMEOUT_MS = 30_000
/** Hero motion and late images settle within this after `load`. */
const SETTLE_MS = 2_500

type ThemeScreenshotOptions = {
  settingsSecret: string
  storefrontUrl: string
  /** Chromium to drive; unset uses Playwright's own download (development only). */
  chromiumPath: string | undefined
  /** Production without `THEME_SCREENSHOT_CHROMIUM`: no browser here, so jobs end at once. */
  disabled?: boolean
}

/** The storefront's home page in a headless Chromium, as a webp of the first screen. */
async function photograph(url: string, chromiumPath: string | undefined): Promise<Uint8Array> {
  const browser = await chromium.launch({
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
    // Containers have a tiny /dev/shm and no user namespaces for the sandbox.
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  })
  try {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })
    // Shoppers' consent banners and popups are part of the page; the picture shows the theme.
    await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS })
    await page.waitForTimeout(SETTLE_MS)
    const png = await page.screenshot({ type: 'png', fullPage: false })
    const webp = await sharp(png).resize({ width: STORED_WIDTH }).webp({ quality: 72 }).toBuffer()
    return new Uint8Array(webp)
  } finally {
    await browser.close()
  }
}

/**
 * Photographs a theme's home page for the Themes page (after Publish, Customize's Save, Edit
 * code's Publish, or a live theme with no picture). Customize's in-browser capture cannot paint
 * an imported (Liquid) theme, so this one opens the storefront's own preview link of the theme
 * in a real browser. One job at a time: Chromium is heavy, and a picture is never urgent.
 */
export function createThemeScreenshotWorker(
  connection: IORedis,
  db: Db,
  opts: ThemeScreenshotOptions,
) {
  const queue = new Queue<ThemeScreenshotJob>(THEME_SCREENSHOT_QUEUE, { connection })
  const worker = new Worker<ThemeScreenshotJob>(
    THEME_SCREENSHOT_QUEUE,
    async (job) => {
      if (opts.disabled) return
      const { storeId, themeId } = job.data
      const target = await withStore(db, storeId, async (tx) => {
        if (!(await getTheme(tx, themeId))) return null
        const origin = await storefrontOriginFor(tx, storeId, opts.storefrontUrl)
        const storage = await storageForStore(
          tx,
          storeId,
          (await registriesForStore(tx, storeId)).storage,
          opts.settingsSecret,
        )
        return { origin, storage }
      })
      if (!target) return
      const token = signThemePreviewToken({ secret: opts.settingsSecret, storeId, themeId })
      const url = `${target.origin}/?theme-preview=${encodeURIComponent(token)}`
      let bytes: Uint8Array
      try {
        bytes = await photograph(url, opts.chromiumPath)
      } catch (err) {
        // No browser on this box, or the storefront did not answer: keep the old picture.
        logger.warn('could not photograph the theme', { storeId, themeId, error: err })
        return
      }
      const stored = await uploadThemeThumbnail(target.storage, { storeId, themeId, bytes })
      await withStore(db, storeId, (tx) => setThemeThumbnail(tx, themeId, stored))
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
