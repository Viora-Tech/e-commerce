/**
 * Release smoke test: a guest walks a live (or local) storefront from the home page to the
 * Payment section of checkout, on a desktop and a phone viewport. It never pays: it stops once
 * the Payment section lists a way to pay, and never clicks Pay or Place order.
 *
 * Built after 21 Oct, when "We do not ship to <PIN>" only showed in checkout's Shipping
 * section, so every page before it looked fine. Developer docs → Release checklist.
 *
 * Usage (runs on Node: Bun on Windows cannot drive Playwright's browser pipe):
 *   bun run smoke:checkout -- --base https://waimers.koomerce.app
 *   bun run smoke:checkout -- --base http://localhost:3001 --viewport phone --query mouse
 *   bun run smoke:checkout -- --pin 744101:AN     # also check a PIN a shopper reported
 * First run on a machine: `bunx playwright install chromium-headless-shell`.
 *
 * Contact details are fixed test values: Amazon SES's success simulator inbox (never a real
 * address) and 9999999999.
 */
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Browser, type BrowserContextOptions, chromium, devices, type Page } from 'playwright'

type Viewport = 'desktop' | 'phone'

type Address = { pincode: string; stateCode: string; stateName: string }

type Result = {
  viewport: Viewport
  step: string
  status: 'pass' | 'fail' | 'skip'
  ms: number
  detail: string
  shot?: string
}

const EMAIL = 'success@simulator.amazonses.com'
const PHONE = '9999999999'
/** The first PIN is the one that broke on 21 Oct; the second covers another state's courier zone. */
const ADDRESSES: Address[] = [
  { pincode: '131001', stateCode: 'HR', stateName: 'Haryana' },
  { pincode: '400001', stateCode: 'MH', stateName: 'Maharashtra' },
]
const CONTEXTS: Record<Viewport, BrowserContextOptions> = {
  desktop: { viewport: { width: 1366, height: 900 } },
  phone: devices['Pixel 7'],
}
const NO_SHIP = /we (do not ship|cannot deliver) to \d{6}/i
const CHECKING = /checking delivery/i
/** Product pages to try before giving up on finding one in stock. */
const MAX_PRODUCTS = 15

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

const base = (arg('base') ?? 'https://waimers.koomerce.app').replace(/\/+$/, '')
const only = arg('viewport') as Viewport | undefined
const queryArg = arg('query')
const extraPin = arg('pin')?.split(':')
if (extraPin) {
  const [pincode = '', stateCode = ''] = extraPin
  ADDRESSES.push({
    pincode,
    stateCode: stateCode.toUpperCase(),
    stateName: stateCode.toUpperCase(),
  })
}
const outDir = join(tmpdir(), `koomerce-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const results: Result[] = []

class StepError extends Error {}

function fail(message: string): never {
  throw new StepError(message)
}

/** Swaps two letters in the middle, so "mouse" becomes "muose": a typo search must still match. */
function typo(word: string): string {
  const i = Math.max(1, Math.floor(word.length / 2) - 1)
  return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2)
}

function oneLine(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

async function productLinks(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator('main a[href*="/products/"]')
    .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname))
  return [...new Set(hrefs.filter((p) => p.split('/').length === 3))]
}

async function mainText(page: Page): Promise<string> {
  return oneLine(await page.locator('main').first().innerText(), 100_000)
}

/** Waits until the Shipping section has stopped asking the courier. */
async function settledDelivery(page: Page): Promise<string> {
  const deadline = Date.now() + 20_000
  let text = await mainText(page)
  while (CHECKING.test(text) && Date.now() < deadline) {
    await page.waitForTimeout(500)
    text = await mainText(page)
  }
  return text
}

async function runViewport(browser: Browser, viewport: Viewport): Promise<void> {
  const context = await browser.newContext(CONTEXTS[viewport])
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const crashes: string[] = []
  page.on('pageerror', (e) => crashes.push(`page error: ${oneLine(e.message, 140)}`))
  page.on('response', (r) => {
    if (r.status() >= 500 && r.url().startsWith(base)) {
      crashes.push(`${r.status()} ${r.url().slice(base.length) || '/'}`)
    }
  })
  // Marketing popups (the signup popup, offers) can open over any page, checkout included.
  await page.addLocatorHandler(
    page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^close$/i }) }),
    async (dialog) => {
      await dialog
        .getByRole('button', { name: /^close$/i })
        .first()
        .click()
    },
    { noWaitAfter: true },
  )

  let broken = false
  const step = async (name: string, body: () => Promise<string>): Promise<void> => {
    if (broken) {
      results.push({
        viewport,
        step: name,
        status: 'skip',
        ms: 0,
        detail: 'an earlier step failed',
      })
      return
    }
    const started = Date.now()
    try {
      const detail = await body()
      results.push({ viewport, step: name, status: 'pass', ms: Date.now() - started, detail })
    } catch (error) {
      broken = true
      const shot = join(
        outDir,
        `${viewport}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`,
      )
      await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined)
      const message = error instanceof StepError ? error.message : (error as Error).message
      results.push({
        viewport,
        step: name,
        status: 'fail',
        ms: Date.now() - started,
        detail: oneLine(message.split('\n')[0] ?? 'failed', 160),
        shot,
      })
    }
  }
  // Browsing steps always run and never block the rest; only the cart and checkout chain.
  const lenient = async (name: string, body: () => Promise<string>): Promise<void> => {
    const before = broken
    broken = false
    await step(name, body)
    broken = before
  }

  let word = queryArg ?? ''
  let inStock: string[] = []

  await lenient('home loads', async () => {
    const response = await page.goto(base, { waitUntil: 'load' })
    if (!response || response.status() >= 400) fail(`home returned ${response?.status()}`)
    const accept = page.getByRole('button', { name: /^(accept|accept all|allow all)$/i }).first()
    const cookies = await accept
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    if (cookies) await accept.click()
    const links = await productLinks(page)
    if (links.length === 0) fail('no product links on the home page')
    return `${links.length} products, cookies ${cookies ? 'accepted' : 'banner not shown'}`
  })

  await lenient('collection lists products', async () => {
    await page.goto(`${base}/collections/all?filter.v.availability=1`, { waitUntil: 'load' })
    inStock = await productLinks(page)
    const handles = await page
      .locator('a[href*="/collections/"]')
      .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname))
    const collection = handles.find(
      (p) => /^\/collections\/[^/]+$/.test(p) && p !== '/collections/all',
    )
    if (!collection) fail('no collection links in the store navigation')
    await page.goto(`${base}${collection}`, { waitUntil: 'load' })
    const listed = await productLinks(page)
    if (listed.length === 0) fail(`${collection} lists no products`)
    if (inStock.length === 0) inStock = listed
    return `${collection}: ${listed.length} products`
  })

  await lenient('search returns products', async () => {
    if (!word) {
      const first = inStock[0]?.split('/')[2] ?? ''
      word = first.split('-').sort((a, b) => b.length - a.length)[0] ?? ''
    }
    if (word.length < 4) fail('could not pick a search word; pass --query')
    await page.goto(`${base}/search?q=${encodeURIComponent(word)}`, { waitUntil: 'load' })
    const found = await productLinks(page)
    if (found.length === 0) fail(`"${word}" found nothing`)
    return `"${word}": ${found.length} products`
  })

  await lenient('typo search still finds', async () => {
    const misspelt = typo(word)
    await page.goto(`${base}/search?q=${encodeURIComponent(misspelt)}`, { waitUntil: 'load' })
    const found = await productLinks(page)
    if (found.length === 0) fail(`"${misspelt}" found nothing`)
    const corrected = (await mainText(page)).match(/Showing results for "([^"]+)"/)?.[1]
    return `"${misspelt}": ${found.length} products${corrected ? `, corrected to "${corrected}"` : ''}`
  })

  let product = ''
  await step('add to cart', async () => {
    for (const href of inStock.slice(0, MAX_PRODUCTS)) {
      await page.goto(`${base}${href}`, { waitUntil: 'load' })
      const button = page.getByRole('button', { name: /add to cart/i }).first()
      if ((await button.count()) === 0 || !(await button.isEnabled())) continue
      await button.click()
      await page.waitForTimeout(2_000)
      product = href
      return href
    }
    return fail(`none of the first ${MAX_PRODUCTS} in-stock products could be added`)
  })

  await step('cart shows the line', async () => {
    await page.goto(`${base}/cart`, { waitUntil: 'load' })
    const main = page.locator('main').first()
    const title = main.locator(`a[href$="${product}"]`).first()
    if ((await title.count()) === 0) fail(`no line for ${product}`)
    const images = await main
      .locator('img')
      .evaluateAll((imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length)
    if (images === 0) fail('the cart line has no loaded image')
    const price = (await mainText(page)).match(/(₹|Rs\.?)\s?[\d,]+(\.\d{2})?/)?.[0]
    if (!price) fail('no price on the cart page')
    return `${product}, ${images} image(s), ${price}`
  })

  await step('cart → checkout', async () => {
    const main = page.locator('main').first()
    await main
      .getByRole('button', { name: /check ?out/i })
      .or(main.getByRole('link', { name: /check ?out/i }))
      .first()
      .click()
    await page.waitForURL(/\/checkout/)
    await page.getByLabel('PIN code').waitFor()
    return new URL(page.url()).pathname
  })

  await step('contact (guest)', async () => {
    const guest = page.getByRole('button', { name: /check out as guest/i })
    const offered = (await guest.count()) > 0
    if (offered) await guest.click()
    await page.getByLabel('Mobile number').first().fill(PHONE)
    await page
      .getByLabel(/^Email/)
      .first()
      .fill(EMAIL)
    return offered ? 'chose "Check out as guest"' : 'guest fields shown directly'
  })

  for (const [index, address] of ADDRESSES.entries()) {
    await step(`delivery to ${address.pincode}`, async () => {
      await page.getByLabel('PIN code').fill(address.pincode)
      await page.getByLabel('PIN code').blur()
      await page.waitForTimeout(1_500)
      if (index === 0) {
        await page.getByLabel('Full name').fill('Smoke Test')
        await page.getByLabel(/House number/).fill('Test street 1')
        await page.getByLabel(/House number/).blur()
      }
      const city = await page.getByLabel('City').inputValue()
      if (!city) fail(`PIN ${address.pincode} did not fill the city`)
      const state = await page.getByLabel('State').inputValue()
      if (state !== address.stateCode) {
        fail(`PIN ${address.pincode} set state "${state}", expected ${address.stateName}`)
      }
      const text = await settledDelivery(page)
      const refused = text.match(NO_SHIP)?.[0]
      if (refused) fail(`Shipping says "${refused}"`)
      if (CHECKING.test(text)) fail('Shipping still "Checking delivery…" after 20 s')
      const options = page.locator('input[name="shipping-rate"]')
      const count = await options.count()
      if (count === 0) fail('Shipping shows no delivery option')
      const first = oneLine(
        await options
          .first()
          .locator('xpath=ancestor::label[1]')
          .innerText()
          .catch(() => ''),
        60,
      )
      return `${city}, ${address.stateName}: ${count} option(s)${first ? `, ${first}` : ''}`
    })
  }

  await step('payment lists a method', async () => {
    const methods = page.locator('input[name="payment"]')
    await methods.first().waitFor({ state: 'attached' })
    const count = await methods.count()
    const labels = await methods.evaluateAll((inputs) =>
      inputs.map((i) => (i.closest('label')?.innerText ?? '').split('\n')[0]?.trim() ?? ''),
    )
    return `${count} method(s): ${oneLine(labels.join(' / '), 80)}. Stopped before Pay`
  })

  await lenient('no crashes or 5xx', async () => {
    const unique = [...new Set(crashes)]
    if (unique.length > 0) fail(unique.slice(0, 3).join('; '))
    return 'none'
  })

  await context.close()
}

function printTable(): void {
  const rows = results.map((r) => [
    r.viewport,
    r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'skip',
    r.step,
    `${(r.ms / 1000).toFixed(1)}s`,
    r.shot ? `${r.detail} [${r.shot}]` : r.detail,
  ])
  const head = ['viewport', 'result', 'step', 'time', 'detail']
  const widths = head.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (i < 4 ? r[i].length : 0))),
  )
  const line = (cells: string[]) =>
    cells.map((c, i) => (i < 4 ? c.padEnd(widths[i]) : c)).join('  ')
  console.log(line(head))
  console.log(line(widths.map((w) => '-'.repeat(w))))
  for (const row of rows) console.log(line(row))
}

mkdirSync(outDir, { recursive: true })
console.log(`Checkout smoke test against ${base}\n`)
const browser = await chromium.launch()
for (const viewport of ['desktop', 'phone'] as const) {
  if (!only || only === viewport) await runViewport(browser, viewport)
}
await browser.close()
printTable()
const failed = results.filter((r) => r.status !== 'pass').length
console.log(
  failed
    ? `\n${failed} step(s) failed or skipped. Screenshots: ${outDir}`
    : `\nAll ${results.length} steps passed.`,
)
process.exit(failed ? 1 : 0)
