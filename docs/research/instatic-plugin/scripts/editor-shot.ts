import { chromium } from 'playwright'

const r = await fetch('http://localhost:3001/admin/api/cms/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3001' },
  body: JSON.stringify({ email: 'eval@koomerce.test', password: 'eval-instatic-2026!' }),
})
const cookies = r.headers.getSetCookie().map((c) => {
  const [nv] = c.split(';')
  const i = nv.indexOf('=')
  return { name: nv.slice(0, i), value: nv.slice(i + 1), domain: 'localhost', path: '/' }
})
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addCookies(cookies)
const page = await ctx.newPage()
const t0 = Date.now()
await page.goto('http://localhost:5173/admin/site', { waitUntil: 'load', timeout: 120000 })
await page.waitForTimeout(15000)
console.log('editor load ms', Date.now() - t0, page.url())
await page.screenshot({ path: '.eval-plugins/landing/screenshot-editor.png' })
const txt = await page.locator('body').innerText()
console.log(txt.slice(0, 800))
await browser.close()
