/**
 * Captures the merchant-guide screenshots from a locally running admin signed in to the
 * fictional "Asha Handlooms" store (scripts/screenshots/seed.ts). Each shot is saved as
 * `public/screenshots/<slug>.webp` (light) and `<slug>.dark.webp` (dark), where the slug comes
 * from the `<Screenshot name="…">` it fills (components/screenshot.tsx `screenshotSlug`).
 *
 *   bun scripts/screenshots/capture.ts                 every shot
 *   bun scripts/screenshots/capture.ts home-dashboard  just these slugs
 *
 * Env: ADMIN_URL (default http://localhost:3700), WWW_URL (default http://localhost:3710),
 * SHOTS_OUT (default public/screenshots). See README "Updating screenshots".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Browser, type BrowserContext, chromium, type Locator, type Page } from 'playwright'
import sharp from 'sharp'

/** This script's folder. */
const HERE = fileURLToPath(new URL('.', import.meta.url))

const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:3700'
const WWW = process.env.WWW_URL ?? 'http://localhost:3710'
const OWNER_EMAIL = 'asha@example.in'
const OUT = resolve(HERE, '../..', process.env.SHOTS_OUT ?? 'public/screenshots')
/** Slow first compiles in `next dev` on a busy machine: be patient. */
const SLOW = 600_000
/** Waits for something on an already loaded screen. */
const WAIT = 90_000
const WIDTH = 1440
/** Final images are at most this wide (2x of a 1200-wide crop), which keeps them under ~300 KB. */
const MAX_PX = 2400

type Theme = 'light' | 'dark'
type Shot = {
  slug: string
  /** Viewport height for this shot (width is always 1440). */
  height?: number
  /** The screen looks the same in both themes: capture it once. */
  lightOnly?: boolean
  /** Needs a signed-in admin (default true). */
  signedIn?: boolean
  /** Opens the screen and puts it in the captioned state; returns the area to crop, or null for the viewport. */
  run: (page: Page, theme: Theme) => Promise<Locator | null>
}

/** Hide dev-only chrome (the Next.js dev badge, toasts) so shots look like production. */
const DEV_CSS = `nextjs-portal, [data-nextjs-toast], [data-sonner-toaster] { display: none !important; }
*, *::before, *::after { caret-color: transparent !important; }`

async function settle(page: Page, ms = 1500): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 120_000 }).catch(() => {})
  await page.addStyleTag({ content: DEV_CSS }).catch(() => {})
  await page.waitForTimeout(ms)
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${ADMIN}${path}`, { timeout: SLOW, waitUntil: 'domcontentloaded' })
  await settle(page)
}

type State = Awaited<ReturnType<BrowserContext['storageState']>>

/** Cookies from the last run, so a rerun does not ask for another (rate-limited) code. */
const STATE_FILE = resolve(HERE, '../../node_modules/.cache/docs-shots-state.json')

/** Signs in once with the dev OTP route and returns the cookies for every later shot. */
async function signIn(browser: Browser): Promise<State> {
  if (existsSync(STATE_FILE)) {
    const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State
    const check = await browser.newContext({ storageState: saved })
    const res = await check.request.get(`${ADMIN}/`, { maxRedirects: 0, timeout: SLOW })
    await check.close()
    if (res.status() === 200) return saved
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${ADMIN}/login`, { timeout: SLOW })
  await page.getByLabel('Email').fill(OWNER_EMAIL)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByText('Check your email').waitFor({ timeout: WAIT })
  const res = await fetch(`${ADMIN}/api/dev/otp?email=${encodeURIComponent(OWNER_EMAIL)}`)
  if (!res.ok) throw new Error('no dev OTP: run the admin with DEV_LOGIN_OTP=1 on localhost')
  const { otp } = (await res.json()) as { otp: string }
  await page.getByLabel('Login code').fill(otp)
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: SLOW })
  const state = await context.storageState()
  await context.close()
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state))
  return state
}

const orderIdByNumber = async (page: Page, n: number): Promise<string> => {
  await open(page, `/orders?q=${n}`)
  const link = page.locator(`a[href^="/orders/"]`, { hasText: `#${n}` }).first()
  const href = await link.getAttribute('href', { timeout: WAIT })
  if (!href) throw new Error(`order #${n} not found`)
  return href
}

/** The admin's main scroll area, right of the sidebar. */
const main = (page: Page): Locator => page.locator('main').first()

const SHOTS: Shot[] = [
  {
    // The public App Store website (apps/www), no sign-in.
    slug: 'app-store-website',
    signedIn: false,
    height: 1100,
    // The website has one (dark) look, so a dark copy would be the same picture.
    lightOnly: true,
    run: async (page) => {
      await page.goto(`${WWW}/apps`, { timeout: SLOW, waitUntil: 'domcontentloaded' })
      await settle(page, 2500)
      const reject = page.getByRole('button', { name: 'Reject non-essential' })
      if (await reject.isVisible().catch(() => false)) await reject.click()
      await settle(page, 1000)
      return null
    },
  },
  {
    slug: 'log-in-screen',
    signedIn: false,
    height: 820,
    run: async (page) => {
      // No real email: answer the send call here (it is rate-limited, and signIn already used it).
      await page.route('**/email-otp/send-verification-otp', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }),
      )
      await page.goto(`${ADMIN}/login`, { timeout: SLOW })
      await page.getByLabel('Email').fill(OWNER_EMAIL)
      await page.getByRole('button', { name: 'Send code' }).click()
      await page.getByText('Check your email').waitFor({ timeout: WAIT })
      await settle(page)
      // The "code is printed in the server log" hint only exists in development.
      await page
        .getByText('In development the code is printed', { exact: false })
        .evaluateAll((els) => {
          for (const el of els) (el as HTMLElement).style.display = 'none'
        })
      return null
    },
  },
  {
    slug: 'home-dashboard',
    height: 2150,
    run: async (page) => {
      await open(page, '/')
      await page.getByText('Latest orders').first().waitFor({ timeout: WAIT })
      await settle(page, 3000)
      return main(page)
    },
  },
  {
    slug: 'order-list-with-tabs',
    height: 900,
    run: async (page) => {
      await open(page, '/orders')
      return main(page)
    },
  },
  {
    slug: 'order-detail',
    height: 1500,
    run: async (page) => {
      const href = await orderIdByNumber(page, 1042)
      await open(page, href)
      await page.getByText('Timeline').first().waitFor({ timeout: WAIT })
      return main(page)
    },
  },
  {
    slug: 'growth-overview',
    height: 1300,
    run: async (page) => {
      await open(page, '/growth')
      await settle(page, 3000)
      return main(page)
    },
  },
  {
    slug: 'themes-library',
    height: 2000,
    run: async (page) => {
      await open(page, '/online-store/themes')
      await page.getByText('Theme library').first().waitFor({ timeout: WAIT })
      await settle(page, 2500)
      return main(page)
    },
  },
  {
    slug: 'domain-detail',
    height: 1000,
    run: async (page) => {
      await open(page, '/settings/domains')
      await page.getByText('ashahandlooms.in', { exact: true }).first().click({ timeout: WAIT })
      await page.waitForURL(/\/settings\/domains\/.+/, { timeout: SLOW })
      await settle(page, 2500)
      return main(page)
    },
  },
  {
    slug: 'gst-invoice-template-preview',
    height: 1300,
    run: async (page) => {
      await installApp(page, 'gst-invoices')
      await open(page, '/apps/gst-invoices/settings')
      // Fold Business details, open Template and style; the PDF preview renders beside them.
      await setOpen(page, 'Business details', false)
      await setOpen(page, 'Documents', false)
      await setOpen(page, 'Template and style', true)
      await page.locator('iframe[title="Preview"]').waitFor({ timeout: WAIT })
      await page.getByText('Rendering preview').waitFor({ state: 'hidden', timeout: WAIT })
      await settle(page, 3000)
      return main(page)
    },
  },
  {
    slug: 'variants-table',
    height: 1400,
    run: async (page) => {
      await open(page, '/products?q=kurta')
      await page.getByText('Indigo handloom cotton kurta').first().click({ timeout: WAIT })
      await page.waitForURL(/\/products\/[^/?]+/, { timeout: SLOW })
      await settle(page)
      // An existing product's Variants tab: the same card Add product fills in.
      await page
        .locator('a, button, [role="tab"]')
        .filter({ hasText: /^Variants/ })
        .first()
        .click()
      await settle(page, 2500)
      return main(page)
    },
  },
  {
    slug: 'editor-add-panel-on-the-apps-tab',
    height: 900,
    run: async (page) => {
      await installApp(page, 'back-in-stock')
      await openEditor(page, '?template=product')
      await page.getByRole('button', { name: 'Add', exact: true }).first().click()
      await page.getByText('Blocks', { exact: true }).first().click()
      await settle(page)
      const apps = page.getByText('Apps', { exact: true }).last()
      await apps.scrollIntoViewIfNeeded()
      await page.getByText('Pre-order countdown').first().scrollIntoViewIfNeeded()
      await settle(page)
      return null
    },
  },
  {
    slug: 'sections-list',
    height: 900,
    run: async (page) => {
      await openEditor(page, '')
      const row = page.getByText('Tabbed product grid', { exact: true }).first()
      await row.hover()
      await page.getByRole('button', { name: 'More actions for Tabbed product grid' }).click()
      await page.getByRole('menuitem', { name: 'Duplicate' }).waitFor({ timeout: WAIT })
      await settle(page, 800)
      return null
    },
  },
  {
    slug: 'section-settings-panel',
    height: 900,
    run: async (page) => {
      await openEditor(page, '')
      await page.getByText('Hero carousel', { exact: true }).first().click()
      await page.getByRole('tab', { name: 'Advanced' }).click()
      await settle(page)
      return null
    },
  },
]

/** Opens or folds a settings group by its heading, reading the toggle's aria-expanded. */
async function setOpen(page: Page, title: string, open: boolean): Promise<void> {
  const toggle = page.locator('[aria-expanded]').filter({ hasText: title }).first()
  if ((await toggle.getAttribute('aria-expanded', { timeout: WAIT })) !== String(open)) {
    await toggle.click()
    await page.waitForTimeout(500)
  }
}

/** Install an app through its own install screen (Permissions → Install), unless it is in. */
async function installApp(page: Page, id: string): Promise<void> {
  await open(page, `/apps/install?app=${id}`)
  const install = page.getByRole('button', { name: 'Install', exact: true })
  if (await install.isVisible().catch(() => false)) {
    await install.click()
    await settle(page, 2500)
  }
}

/** The theme editor on the live theme (Online Store → Themes → Customize). */
async function openEditor(page: Page, query: string): Promise<void> {
  await open(page, '/online-store/themes')
  const link = page.getByRole('link', { name: 'Customize' }).first()
  const href = await link.getAttribute('href', { timeout: WAIT }).catch(() => null)
  if (href) await open(page, `${href.split('?')[0]}${query}`)
  else {
    await page.getByRole('button', { name: 'Customize' }).first().click()
    await page.waitForURL(/\/editor/, { timeout: SLOW })
    if (query) await open(page, `${new URL(page.url()).pathname}${query}`)
  }
  await page.getByText('Layers').first().waitFor({ timeout: WAIT })
  await settle(page, 2500)
}

async function capture(
  browser: Browser,
  shot: Shot,
  theme: Theme,
  state: State | undefined,
): Promise<void> {
  const context = await browser.newContext({
    storageState: shot.signedIn === false ? undefined : state,
    viewport: { width: WIDTH, height: shot.height ?? 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  })
  try {
    const page = await context.newPage()
    const area = await shot.run(page, theme).catch(async (err: unknown) => {
      // What the screen looked like when a step gave up, to see why.
      await page.screenshot({ path: join(dirname(STATE_FILE), `failed-${shot.slug}.png`) })
      throw err
    })
    const png = area ? await area.screenshot() : await page.screenshot()
    const img = sharp(png)
    const { width = 0 } = await img.metadata()
    const webp = await img
      .resize({ width: Math.min(width, MAX_PX), withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toBuffer()
    const file = join(OUT, `${shot.slug}${theme === 'dark' ? '.dark' : ''}.webp`)
    writeFileSync(file, webp)
    console.log(`${file}  ${Math.round(webp.length / 1024)} KB`)
  } finally {
    await context.close()
  }
}

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const themes: Theme[] = process.argv.includes('--light-only') ? ['light'] : ['light', 'dark']
mkdirSync(OUT, { recursive: true })
// Google Chrome (not the bundled headless shell): only a full browser renders the GST invoice
// PDF preview, which sits in an <iframe>. SHOTS_CHROME points at another Chrome or Chromium.
const browser = await chromium.launch(
  process.env.SHOTS_CHROME ? { executablePath: process.env.SHOTS_CHROME } : { channel: 'chrome' },
)
const failed: string[] = []
try {
  const shots = SHOTS.filter((shot) => !wanted.length || wanted.includes(shot.slug))
  // Only sign in (and so only need the admin running) when a chosen shot needs it.
  const state = shots.some((shot) => shot.signedIn !== false) ? await signIn(browser) : undefined
  for (const shot of shots) {
    for (const theme of shot.lightOnly ? (['light'] as Theme[]) : themes) {
      try {
        await capture(browser, shot, theme, state)
      } catch (err) {
        failed.push(`${shot.slug} (${theme})`)
        console.error(`FAILED ${shot.slug} (${theme}):`, String(err).slice(0, 400))
      }
    }
  }
} finally {
  await browser.close()
}
if (failed.length) {
  console.error(`\n${failed.length} failed: ${failed.join(', ')}`)
  process.exit(1)
}
