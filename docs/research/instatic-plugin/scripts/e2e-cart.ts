import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 412, height: 823 } })
const reqs: string[] = []
const errors: string[] = []
page.on('request', (r) =>
  reqs.push(`${r.method()} ${r.url().replace('http://localhost:4100', '')}`),
)
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:4100/', { waitUntil: 'networkidle' })
const before = await page.locator('[data-instatic-loop]').count()
await page.locator('h2:has-text("Live stock")').scrollIntoViewIfNeeded()
await page.waitForTimeout(1500)
const loops = await page.locator('[data-instatic-loop]').count()
const btn = page.locator('[data-koomerce-add="PX2H11"]').first()
await btn.click()
await page.waitForTimeout(800)
const label = await btn.textContent()
const count = await page.locator('[data-koomerce-cart-count]').first().textContent()
const hidden = await page.locator('[data-koomerce-cart-count]').first().getAttribute('hidden')
// Buttons inside the dynamic hole fragment must work too.
await page.locator('[data-instatic-loop]').nth(1).locator('[data-koomerce-add]').first().click()
await page.waitForTimeout(800)
const count2 = await page.locator('[data-koomerce-cart-count]').first().textContent()
await page.screenshot({ path: '.eval-plugins/landing/screenshot-mobile.png', fullPage: true })
console.log(
  JSON.stringify(
    {
      loopsBeforeScroll: before,
      loopsAfterScroll: loops,
      label,
      count,
      hidden,
      count2,
      errors,
      reqs,
    },
    null,
    2,
  ),
)
await browser.close()
