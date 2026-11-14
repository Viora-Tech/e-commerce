/**
 * SPIKE: serves the built SPA the way any static host would (hashed assets with a long cache,
 * the prerendered shell for every page) and forwards `/api/*` to the admin's server, which
 * still owns oRPC, Better Auth and webhooks. Stands in for nginx / Cloudflare Pages in the
 * measurements; there is no app server in the lab.
 */
import { existsSync, statSync } from 'node:fs'
import { join, normalize } from 'node:path'

const PORT = Number(process.env.PORT ?? 3300)
const API = process.env.ADMIN_API ?? 'http://localhost:3200'
const ROOT = join(import.meta.dir, 'dist', 'client')
const SHELL = ['_shell.html', 'index.html'].map((f) => join(ROOT, f)).find((f) => existsSync(f))

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) {
      const headers = new Headers(req.headers)
      headers.set('host', new URL(API).host)
      return fetch(`${API}${url.pathname}${url.search}`, {
        method: req.method,
        headers,
        body: req.body,
        redirect: 'manual',
      })
    }
    const path = normalize(join(ROOT, decodeURIComponent(url.pathname)))
    if (path.startsWith(ROOT) && existsSync(path) && statSync(path).isFile()) {
      const immutable = url.pathname.startsWith('/assets/')
      return new Response(Bun.file(path), {
        headers: immutable ? { 'Cache-Control': 'public, max-age=31536000, immutable' } : {},
      })
    }
    if (!SHELL) return new Response('Build first: bun run build', { status: 500 })
    return new Response(Bun.file(SHELL), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  },
})
console.log(`admin-lab on http://localhost:${PORT} (API -> ${API})`)
