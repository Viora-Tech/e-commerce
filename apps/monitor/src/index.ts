/**
 * The platform's alarm: uptime checks on a cron and Dokploy's server alerts, both emailed
 * through Email Routing (`NOTIFY`, which can only send to its one verified address).
 *
 * - `scheduled` (every 5 minutes): runs every check in `CHECKS`, keeps up/down per check in
 *   KV, and emails only when one goes down or comes back.
 * - `POST /dokploy?token=…`: Dokploy's custom notification (CPU or memory over its threshold,
 *   a failed deploy, a stopped container). The token must match the DOKPLOY_TOKEN secret.
 */
import { EmailMessage } from 'cloudflare:email'
import { siteConfig } from '@commerce/config/site'
import {
  CHECKS,
  type Check,
  type CheckState,
  FRESH,
  nextState,
  sameState,
  TIMEOUT_MS,
} from './checks'

type Env = {
  STATE: KVNamespace
  NOTIFY: SendEmail
  DOKPLOY_TOKEN: string
}

const FROM = 'monitor@koomerce.app'
const TO = 'vioramice@gmail.com'
const MAX_BODY_BYTES = 32_768

/** One line, printable ASCII only: safe in an email header. */
const headerSafe = (value: string, max: number) =>
  value
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
    .slice(0, max)

async function sendMail(env: Env, subject: string, text: string) {
  const raw = [
    `From: ${siteConfig.brand.name} monitor <${FROM}>`,
    `To: ${TO}`,
    `Subject: ${headerSafe(subject, 150)}`,
    `Message-ID: <${crypto.randomUUID()}@koomerce.app>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
  ].join('\r\n')
  await env.NOTIFY.send(new EmailMessage(FROM, TO, raw))
}

/** One GET: ok on 2xx within the timeout; the detail says what went wrong otherwise. */
async function probe(check: Check): Promise<{ ok: boolean; detail: string; ms: number }> {
  const started = Date.now()
  try {
    const res = await fetch(check.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'koomerce-monitor' },
      cf: { cacheTtl: 0 },
    })
    await res.body?.cancel()
    const ms = Date.now() - started
    return { ok: res.ok, detail: res.ok ? '' : `HTTP ${res.status}`, ms }
  } catch (err) {
    const ms = Date.now() - started
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return { ok: false, detail: timedOut ? `no answer in ${TIMEOUT_MS / 1000}s` : String(err), ms }
  }
}

const IST = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

async function runChecks(env: Env) {
  const now = new Date().toISOString()
  await Promise.all(
    CHECKS.map(async (check) => {
      const key = `check:${check.id}`
      const prev = (await env.STATE.get<CheckState>(key, 'json')) ?? FRESH
      const result = await probe(check)
      const { state, event } = nextState(prev, result.ok, result.detail, now)
      if (!sameState(prev, state)) await env.STATE.put(key, JSON.stringify(state))
      if (event === 'down') {
        await sendMail(
          env,
          `DOWN: ${check.name}`,
          `${check.name} is not answering.\n\n${check.url}\n${result.detail}\nSince: ${IST(now)} IST\n\nYou will get one more email when it is back.`,
        )
      } else if (event === 'up') {
        await sendMail(
          env,
          `UP again: ${check.name}`,
          `${check.name} is answering again (${result.ms} ms).\n\n${check.url}\nDown since: ${prev.since ? `${IST(prev.since)} IST` : 'unknown'}\nLast error: ${prev.detail || '-'}`,
        )
      }
    }),
  )
}

/** Dokploy's custom notification body, read loosely: its shape differs per event. */
async function handleDokploy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  if (!env.DOKPLOY_TOKEN || url.searchParams.get('token') !== env.DOKPLOY_TOKEN) {
    return new Response('forbidden', { status: 403 })
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return new Response('too large', { status: 413 })
  }
  const text = (await request.text()).slice(0, MAX_BODY_BYTES)
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(text) as Record<string, unknown>
  } catch {
    body = { message: text }
  }
  const title = String(body.title ?? body.type ?? body.event ?? 'Dokploy alert')
  const details = Object.entries(body)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('\n')
  await sendMail(
    env,
    `Dokploy: ${title}`,
    `${details}\n\nReceived ${IST(new Date().toISOString())} IST`,
  )
  return new Response('ok')
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runChecks(env))
  },
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/dokploy') {
      return handleDokploy(request, env).catch((err) => {
        console.error('dokploy alert failed', String(err))
        return new Response('error', { status: 500 })
      })
    }
    return new Response('koomerce-monitor', { status: 404 })
  },
} satisfies ExportedHandler<Env>
