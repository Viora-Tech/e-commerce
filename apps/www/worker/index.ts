/**
 * The site's only server code: `POST /api/forms` (waitlist, contact, changelog). Every other
 * request is a static file and never reaches this Worker (`run_worker_first` in wrangler.jsonc).
 *
 * A submission is accepted only with a valid Turnstile token for the same form, is checked
 * again here (the browser's checks are for feedback only), stored in D1 (`submissions`, see
 * migrations/), and for the waitlist and contact forms emailed to the team through Email
 * Routing (`NOTIFY`, which can only send to its one verified address).
 */
import { EmailMessage } from 'cloudflare:email'

type Env = {
  ASSETS: Fetcher
  DB: D1Database
  NOTIFY: SendEmail
  TURNSTILE_SECRET: string
}

type Kind = 'waitlist' | 'contact' | 'changelog'
type Status = 'ok' | 'duplicate' | 'invalid' | 'error'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_BODY_BYTES = 16_384
const FROM = 'forms@koomerce.app'
const ALLOWED_ORIGINS = new Set(['https://koomerce.app', 'http://localhost:3300'])

const reply = (status: Status, code = 200) => Response.json({ status }, { status: code })

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

/** One line, printable ASCII only: safe in an email header. */
const headerSafe = (value: string, max: number) =>
  value
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
    .slice(0, max)

type Checked = { email: string; data: Record<string, unknown>; summary: string; subject: string }

function check(kind: Kind, raw: Record<string, unknown>): Checked | null {
  const email = text(raw.email, 254)
  if (!EMAIL_PATTERN.test(email)) return null
  if (kind === 'changelog') return { email, data: {}, summary: '', subject: '' }
  if (kind === 'waitlist') {
    const sell = text(raw.sell, 200)
    if (sell.length < 2) return null
    const channels = Array.isArray(raw.channels)
      ? raw.channels
          .slice(0, 8)
          .map((c) => text(c, 60))
          .filter(Boolean)
      : []
    return {
      email,
      data: { sell, channels },
      summary: `Email: ${email}\nSells: ${sell}\nSells on: ${channels.join(', ') || '-'}`,
      subject: `Waitlist: ${headerSafe(email, 80)}`,
    }
  }
  const name = text(raw.name, 100)
  const message = text(raw.message, 4000)
  const topic = text(raw.topic, 60)
  const store = text(raw.store, 200)
  if (name.length < 2 || message.length < 5 || raw.consent !== 'on') return null
  return {
    email,
    data: { name, topic, store, message },
    summary: `From: ${name} <${email}>\nTopic: ${topic || '-'}\nStore: ${store || '-'}\n\n${message}`,
    subject: `Contact: ${headerSafe(topic || 'message', 60)} from ${headerSafe(name, 60)}`,
  }
}

async function turnstileOk(env: Env, token: string, ip: string | null, action: Kind) {
  const form = new FormData()
  form.append('secret', env.TURNSTILE_SECRET)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  })
  const out = (await res.json()) as { success?: boolean; action?: string }
  return out.success === true && out.action === action
}

async function notify(env: Env, kind: Kind, checked: Checked) {
  const raw = [
    `From: Koomerce site <${FROM}>`,
    `To: team`,
    `Reply-To: ${checked.email}`,
    `Subject: ${checked.subject}`,
    `Message-ID: <${crypto.randomUUID()}@koomerce.app>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    `New ${kind} submission on koomerce.app`,
    '',
    checked.summary,
    '',
  ].join('\r\n')
  // The binding fixes the recipient (its verified destination address); `To` is display only.
  await env.NOTIFY.send(new EmailMessage(FROM, 'vioramice@gmail.com', raw))
}

async function handleForm(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'POST') return reply('error', 405)
  const origin = request.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply('error', 403)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return reply('invalid', 413)
  }

  const body = (await request.json().catch(() => null)) as {
    kind?: unknown
    fields?: unknown
    token?: unknown
  } | null
  const kind = body?.kind
  if (kind !== 'waitlist' && kind !== 'contact' && kind !== 'changelog') {
    return reply('invalid', 400)
  }
  const fields = body?.fields
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token || !fields || typeof fields !== 'object') return reply('invalid', 400)

  const checked = check(kind, fields as Record<string, unknown>)
  if (!checked) return reply('invalid', 400)

  const ip = request.headers.get('cf-connecting-ip')
  if (!(await turnstileOk(env, token, ip, kind).catch(() => false))) return reply('error', 403)

  // One waitlist or changelog entry per email (a partial unique index); contact messages repeat.
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO submissions (kind, email, data, country, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(
      kind,
      checked.email.toLowerCase(),
      JSON.stringify(checked.data),
      request.headers.get('cf-ipcountry'),
      new Date().toISOString(),
    )
    .run()
  if (result.meta.changes === 0) return reply('duplicate')

  if (kind !== 'changelog') {
    ctx.waitUntil(
      notify(env, kind, checked).catch((err) => console.error('form email failed', String(err))),
    )
  }
  return reply('ok')
}

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/api/forms') {
      return handleForm(request, env, ctx).catch((err) => {
        console.error('form failed', String(err))
        return reply('error', 500)
      })
    }
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
