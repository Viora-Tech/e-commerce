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
import { siteConfig } from '@commerce/config/site'

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

/** One labelled value in the notification; `long` values (a message) get their own block. */
type Field = { label: string; value: string; long?: boolean }
type Checked = { email: string; data: Record<string, unknown>; fields: Field[]; subject: string }

function check(kind: Kind, raw: Record<string, unknown>): Checked | null {
  const email = text(raw.email, 254)
  if (!EMAIL_PATTERN.test(email)) return null
  if (kind === 'changelog') return { email, data: {}, fields: [], subject: '' }
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
      fields: [
        { label: 'Email', value: email },
        { label: 'Sells', value: sell },
        { label: 'Sells on', value: channels.join(', ') || '-' },
      ],
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
    fields: [
      { label: 'Name', value: name },
      { label: 'Email', value: email },
      { label: 'Topic', value: topic || '-' },
      { label: 'Store', value: store || '-' },
      { label: 'Message', value: message, long: true },
    ],
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
  // Cloudflare's outage, not a bad token: say so in the logs, the visitor sees "try again".
  if (!res.ok) {
    console.error('turnstile check failed', res.status)
    return false
  }
  const out = (await res.json()) as { success?: boolean; action?: string }
  return out.success === true && out.action === action
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const TITLES: Record<Exclude<Kind, 'changelog'>, string> = {
  waitlist: 'New waitlist signup',
  contact: 'New contact message',
}
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#171717'
const MUTED = '#6b6b6b'
const LINE = '#e6e6e6'

/** The notification as a card: brand mark, heading, the fields as a table, a Reply button. */
function notificationHtml(kind: Exclude<Kind, 'changelog'>, checked: Checked, at: Date) {
  const when = at.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const rows = checked.fields
    .filter((f) => !f.long)
    .map(
      (f) =>
        `<tr><td width="96" valign="top" style="padding:10px 0;border-top:1px solid ${LINE};font-size:13px;color:${MUTED}">${escapeHtml(f.label)}</td><td style="padding:10px 0;border-top:1px solid ${LINE};font-size:15px;color:${INK};word-break:break-word">${escapeHtml(f.value)}</td></tr>`,
    )
    .join('')
  const blocks = checked.fields
    .filter((f) => f.long)
    .map(
      (f) =>
        `<p style="margin:24px 0 8px;font-size:13px;color:${MUTED}">${escapeHtml(f.label)}</p><div style="padding:16px;background:#f7f7f7;border-radius:8px;font-size:15px;line-height:1.55;color:${INK};white-space:pre-wrap;word-break:break-word">${escapeHtml(f.value)}</div>`,
    )
    .join('')
  const replyHref = `mailto:${encodeURIComponent(checked.email)}?subject=${encodeURIComponent(`Re: ${siteConfig.brand.name}`)}`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:${FONT}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;border:1px solid ${LINE}"><tr><td style="padding:28px 32px 0"><a href="https://koomerce.app" style="text-decoration:none;color:${INK}"><img src="https://koomerce.app/icon-192.png" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;width:28px;height:28px;border:0;border-radius:6px"><span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:16px;font-weight:700;letter-spacing:-0.01em">${siteConfig.brand.name}</span></a></td></tr><tr><td style="padding:24px 32px 8px"><h1 style="margin:0 0 4px;font-size:22px;line-height:1.3;font-weight:700;color:${INK}">${TITLES[kind]}</h1><p style="margin:0 0 20px;font-size:14px;color:${MUTED}">From the form on koomerce.app &middot; ${escapeHtml(when)} IST</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${LINE}">${rows}</table>${blocks}</td></tr><tr><td style="padding:24px 32px 32px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${INK};border-radius:8px"><a href="${escapeHtml(replyHref)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">Reply to ${escapeHtml(checked.email)}</a></td></tr></table></td></tr></table><p style="margin:16px 0 0;font-size:12px;color:${MUTED}">Sent by the koomerce.app form Worker. Replying goes to the person who filled the form.</p></td></tr></table></body></html>`
}

function notificationText(kind: Exclude<Kind, 'changelog'>, checked: Checked) {
  const lines = checked.fields.map((f) =>
    f.long ? `\r\n${f.label}:\r\n${f.value}` : `${f.label}: ${f.value}`,
  )
  return [`${TITLES[kind]} on koomerce.app`, '', ...lines, ''].join('\r\n')
}

/** RFC 2045 base64 body, wrapped at 76 characters; handles any UTF-8 the visitor typed. */
const base64Body = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return (btoa(binary).match(/.{1,76}/g) ?? []).join('\r\n')
}

async function notify(env: Env, kind: Exclude<Kind, 'changelog'>, checked: Checked) {
  const at = new Date()
  const boundary = `koomerce-${crypto.randomUUID()}`
  const raw = [
    `From: ${siteConfig.brand.name} <${FROM}>`,
    `To: team`,
    `Reply-To: ${checked.email}`,
    `Subject: ${checked.subject}`,
    `Message-ID: <${crypto.randomUUID()}@koomerce.app>`,
    `Date: ${at.toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(notificationText(kind, checked)),
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(notificationHtml(kind, checked, at)),
    `--${boundary}--`,
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
