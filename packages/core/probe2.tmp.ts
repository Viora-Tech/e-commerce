import { readCapped, safeFetch } from './src/net/safe-fetch'

const res = await safeFetch('https://waimers.in/', { timeoutMs: 20_000 })
const bytes = await readCapped(res, 8 * 1024 * 1024)
const html = bytes ? new TextDecoder().decode(bytes) : ''
const sectionKey = 'hero'
const start = html.search(new RegExp(`id="shopify-section-[^"]*__${sectionKey.replace(/[^\w-]/g, '')}"`))
const next = html.indexOf('id="shopify-section-', start + 20)
const chunk = html.slice(start, next === -1 ? undefined : next)
console.log('chunk', start, next, chunk.length)
let n = 0
for (const m of chunk.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/g)) {
  n++
  const src = /<source[^>]*\bsrc="([^"]+\.mp4[^"]*)"/.exec(m[2] ?? '')?.[1]
  console.log(n, src?.slice(0, 80))
}
const v = await safeFetch('https://waimers.in/cdn/shop/videos/c/vp/0676880f0b7245c89dbf4441db4936bc/0676880f0b7245c89dbf4441db4936bc.HD-1080p-7.2Mbps-95472380.mp4?v=0', { timeoutMs: 60_000 })
console.log('video', v.status, v.headers.get('content-type'), v.headers.get('content-length'))
await v.body?.cancel()
