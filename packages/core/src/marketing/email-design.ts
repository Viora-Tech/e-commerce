import { z } from 'zod'
import {
  type EmailLabels,
  type EmailRenderContext,
  escapeHtml,
  MERGE_TAGS,
  type MergeValues,
  safeUrl,
} from './email'

/**
 * The visual (GrapesJS + MJML) email builder's pure side: the stored design, the store blocks
 * it inserts as MJML, and the send-time pass over the compiled HTML (merge tags, click
 * tracking, unsubscribe footer, open pixel, plain-text part). MJML → HTML compiling needs the
 * `mjml` package and lives in `./email-design-compile` (server only).
 */

export const EMAIL_EDITORS = ['blocks', 'visual'] as const
export type EmailEditor = (typeof EMAIL_EDITORS)[number]

/** 400 kB of MJML is far beyond any real email; the project JSON is bounded on its own. */
export const MAX_DESIGN_MJML = 400_000
export const MAX_DESIGN_PROJECT = 2_000_000

export const EmailDesignSchema = z.object({
  /** GrapesJS `getProjectData()`; only the builder reads it back. */
  project: z
    .unknown()
    .refine((p) => JSON.stringify(p ?? null).length <= MAX_DESIGN_PROJECT, 'design is too large'),
  mjml: z.string().max(MAX_DESIGN_MJML),
  /** Compiled on the server on every save; what the client sends here is only a preview. */
  html: z
    .string()
    .max(MAX_DESIGN_MJML * 4)
    .default(''),
})
export type EmailDesign = z.infer<typeof EmailDesignSchema>

/** The compiled visual design a campaign sends, or undefined when it sends its blocks. */
export function designHtmlOf(c: {
  editor: string
  design: { html: string } | null
}): string | undefined {
  return c.editor === 'visual' && c.design?.html ? c.design.html : undefined
}

/** Merge tags the visual builder offers: the sender's tags plus the unsubscribe link. */
export const DESIGN_MERGE_TAGS = [...MERGE_TAGS, 'unsubscribe_url'] as const
export type DesignMergeTag = (typeof DESIGN_MERGE_TAGS)[number]

const TAG = /\{([a-z_]+)\}/g

function fill(input: string, values: Partial<Record<DesignMergeTag, string>>, html: boolean) {
  return input.replace(TAG, (whole, tag: string) => {
    if (!(DESIGN_MERGE_TAGS as readonly string[]).includes(tag)) return whole
    const v = values[tag as DesignMergeTag] ?? ''
    return html ? escapeHtml(v) : v
  })
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z0-9]+);/gi, (whole, name: string) => {
    const lower = name.toLowerCase()
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16))
    if (lower.startsWith('#') && lower !== '#39') {
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10))
    }
    return ENTITIES[lower] ?? whole
  })
}

/**
 * Strips what has no place in an email: scripts, inline event handlers, `javascript:` links
 * and frames. Mail clients drop these anyway; the admin preview must never run them.
 */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|form)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, '$1=$2#$2')
}

/** The plain-text alternative: links as "label (url)", images as their alt text. */
export function htmlToPlainText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<(style|script|title)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<div\b[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = tag.match(/\balt\s*=\s*"([^"]*)"/i)?.[1] ?? ''
      return alt ? ` ${alt} ` : ''
    })
    .replace(/<a\b[^>]*\bhref\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_w, href, inner) => {
      const label = String(inner)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const url = decodeEntities(String(href))
      if (!/^(https?:|mailto:)/i.test(url)) return label
      if (!label || decodeEntities(label) === url) return url
      return `${label} (${url})`
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\b[^>]*>/gi, '\n---\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|tr|table|h[1-6]|li|ul|ol|section)>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/ |​|‌| |﻿|͏/g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const FOOTER_STYLE =
  'padding:24px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b6b6b;text-align:center'

function insertBeforeBodyEnd(html: string, fragment: string): string {
  const at = html.search(/<\/body\s*>/i)
  return at === -1 ? html + fragment : html.slice(0, at) + fragment + html.slice(at)
}

function insertAfterBodyStart(html: string, fragment: string): string {
  const m = html.match(/<body\b[^>]*>/i)
  if (!m || m.index === undefined) return fragment + html
  const at = m.index + m[0].length
  return html.slice(0, at) + fragment + html.slice(at)
}

/** Whether a design carries its own unsubscribe link; without one the standard footer is added. */
export function hasUnsubscribeTag(htmlOrMjml: string): boolean {
  return htmlOrMjml.includes('{unsubscribe_url}')
}

/**
 * Turns a compiled design into the email one recipient gets: merge tags filled (escaped in
 * text, raw in links), every http(s) link through `trackLink` except the unsubscribe link, the
 * campaign's preview text, the legally required footer when the design has no unsubscribe
 * link of its own, and the open pixel. Returns the HTML and its plain-text alternative.
 */
export function renderDesignedEmail(
  designHtml: string,
  input: EmailRenderContext & { labels?: Partial<EmailLabels> | undefined },
): { html: string; text: string } {
  const unsubscribe = input.unsubscribeUrl
  const values: Partial<Record<DesignMergeTag, string>> = {
    store_name: input.storeName,
    shop_url: input.shopUrl,
    ...(input.merge as MergeValues),
    unsubscribe_url: unsubscribe ?? '#',
  }
  const ownFooter = hasUnsubscribeTag(designHtml)
  let html = sanitizeEmailHtml(designHtml).replace(
    /(\shref\s*=\s*)"([^"]*)"/gi,
    (_w, lead: string, raw: string) => {
      const url = fill(decodeEntities(raw), values, false).trim()
      if (unsubscribe && url === unsubscribe) return `${lead}"${escapeHtml(url)}"`
      const safe = safeUrl(url)
      if (!safe) return `${lead}"${escapeHtml(url.startsWith('#') ? url : '#')}"`
      const tracked = input.trackLink && /^https?:/i.test(safe) ? input.trackLink(safe) : safe
      return `${lead}"${escapeHtml(tracked)}"`
    },
  )
  html = fill(html, values, true)

  if (input.previewText) {
    const preview = escapeHtml(fill(input.previewText, values, false))
    html = insertAfterBodyStart(
      html,
      `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preview}${'&#8199;&#65279;&#847; '.repeat(40)}</div>`,
    )
  }
  if (!ownFooter && unsubscribe) {
    const reason =
      input.labels?.reason ??
      ((store: string) => `You are receiving this because you subscribed to emails from ${store}.`)
    const label = input.labels?.unsubscribe ?? 'Unsubscribe'
    const address = input.storeAddress
      ? `<br>${escapeHtml(input.storeName)}, ${escapeHtml(input.storeAddress)}`
      : ''
    html = insertBeforeBodyEnd(
      html,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="${FOOTER_STYLE}">${escapeHtml(reason(input.storeName))} <a href="${escapeHtml(unsubscribe)}" style="color:#6b6b6b;text-decoration:underline">${escapeHtml(label)}</a>${address}</td></tr></table>`,
    )
  }
  const text = htmlToPlainText(html)
  if (input.openPixelUrl) {
    html = insertBeforeBodyEnd(
      html,
      `<img src="${escapeHtml(input.openPixelUrl)}" alt="" width="1" height="1" style="display:block;border:0;width:1px;height:1px">`,
    )
  }
  return { html, text }
}

// --- store blocks as MJML -----------------------------------------------------------------

export type EmailBrandColours = {
  background: string
  text: string
  muted: string
  button: string
  buttonText: string
}

/** The store's look, from the live theme: what the builder's store blocks are drawn with. */
export type EmailBrand = {
  storeName: string
  logoUrl: string | null
  logoWidth: number
  colours: EmailBrandColours
  social: { platform: string; url: string }[]
}

export type EmailProductCard = {
  title: string
  priceLabel: string
  imageUrl?: string | null | undefined
  handle: string
}

const attr = (s: string) => escapeHtml(s)
const COLOUR = /^#[0-9a-f]{3,8}$/i
const colour = (c: string, fallback: string) => (COLOUR.test(c) ? c : fallback)

/** Product link through the `{shop_url}` merge tag, so it follows the store's domain at send time. */
export function productHref(handle: string): string {
  return `{shop_url}/products/${encodeURIComponent(handle)}`
}

/** One product per column, `columns` to a row (rows stack on phones). */
export function productGridMjml(
  items: EmailProductCard[],
  brand: EmailBrand,
  opts: { columns?: 1 | 2 | 3; buttonLabel: string },
): string {
  const columns = opts.columns ?? 2
  const c = brand.colours
  const cell = (p: EmailProductCard) => {
    const href = attr(productHref(p.handle))
    const img = p.imageUrl && safeUrl(p.imageUrl)
    return `<mj-column>${
      img
        ? `<mj-image src="${attr(img)}" alt="${attr(p.title)}" href="${href}" border-radius="8px" padding="0 8px 8px" />`
        : ''
    }<mj-text font-size="15px" font-weight="600" color="${colour(c.text, '#1a1a1a')}" padding="4px 8px 0">${escapeHtml(p.title)}</mj-text><mj-text font-size="14px" color="${colour(c.muted, '#6b6b6b')}" padding="2px 8px 8px">${escapeHtml(p.priceLabel)}</mj-text><mj-button href="${href}" background-color="${colour(c.button, '#1a1a1a')}" color="${colour(c.buttonText, '#ffffff')}" border-radius="6px" font-size="14px" padding="0 8px 16px">${escapeHtml(opts.buttonLabel)}</mj-button></mj-column>`
  }
  const rows: string[] = []
  for (let i = 0; i < items.length; i += columns) {
    const slice = items.slice(i, i + columns)
    rows.push(`<mj-section padding="0 16px">${slice.map(cell).join('')}</mj-section>`)
  }
  // Several rows travel as one wrapper, so the builder inserts and moves them as one block.
  return rows.length > 1 ? `<mj-wrapper padding="0">${rows.join('')}</mj-wrapper>` : (rows[0] ?? '')
}

export function discountMjml(
  input: { code: string; heading: string; note?: string | undefined },
  brand: EmailBrand,
): string {
  const c = brand.colours
  const note = input.note
    ? `<mj-text align="center" font-size="14px" color="${colour(c.muted, '#6b6b6b')}" padding="8px 0 0">${escapeHtml(input.note)}</mj-text>`
    : ''
  return `<mj-section padding="8px 32px"><mj-column border="1px dashed ${colour(c.button, '#1a1a1a')}" border-radius="8px" padding="16px"><mj-text align="center" font-size="13px" letter-spacing="1px" text-transform="uppercase" color="${colour(c.muted, '#6b6b6b')}" padding="0 0 6px">${escapeHtml(input.heading)}</mj-text><mj-text align="center" font-size="26px" font-weight="700" letter-spacing="2px" color="${colour(c.text, '#1a1a1a')}" padding="0">${escapeHtml(input.code)}</mj-text>${note}</mj-column></mj-section>`
}

export function logoMjml(brand: EmailBrand): string {
  const logo = brand.logoUrl && safeUrl(brand.logoUrl)
  const inner = logo
    ? `<mj-image src="${attr(logo)}" alt="${attr(brand.storeName)}" href="{shop_url}" width="${Math.min(Math.max(brand.logoWidth, 60), 320)}px" padding="24px 32px 16px" />`
    : `<mj-text align="center" font-size="22px" font-weight="700" color="${colour(brand.colours.text, '#1a1a1a')}" padding="24px 32px 16px"><a href="{shop_url}" style="color:inherit;text-decoration:none">${escapeHtml(brand.storeName)}</a></mj-text>`
  return `<mj-section padding="0"><mj-column>${inner}</mj-column></mj-section>`
}

const MJML_SOCIAL = new Set([
  'facebook',
  'twitter',
  'x',
  'instagram',
  'youtube',
  'linkedin',
  'pinterest',
])

/** The theme's social profiles; networks MJML has no icon for use its generic web icon. */
export function socialMjml(brand: EmailBrand): string {
  const links = brand.social.filter((s) => safeUrl(s.url))
  if (links.length === 0) return ''
  const items = links
    .map((s) => {
      const name = MJML_SOCIAL.has(s.platform) ? s.platform : 'web'
      return `<mj-social-element name="${name}-noshare" href="${attr(s.url)}"></mj-social-element>`
    })
    .join('')
  return `<mj-section padding="8px 32px"><mj-column><mj-social mode="horizontal" icon-size="24px" padding="0">${items}</mj-social></mj-column></mj-section>`
}

/** The footer with the `{unsubscribe_url}` link bulk-mail rules require. */
export function footerMjml(
  brand: EmailBrand,
  labels: { reason: string; unsubscribe: string },
): string {
  return `<mj-section padding="16px 32px 32px"><mj-column><mj-divider border-width="1px" border-color="#e6e6e6" padding="0 0 16px" /><mj-text align="center" font-size="12px" line-height="1.5" color="${colour(brand.colours.muted, '#6b6b6b')}" padding="0">${escapeHtml(labels.reason)} <a href="{unsubscribe_url}" style="color:inherit;text-decoration:underline">${escapeHtml(labels.unsubscribe)}</a><br>{store_name}</mj-text></mj-column></mj-section>`
}

/** A new design: logo, a greeting, a button, socials and the footer, in the store's colours. */
export function starterMjml(
  brand: EmailBrand,
  copy: {
    heading: string
    body: string
    button: string
    reason: string
    unsubscribe: string
  },
): string {
  const c = brand.colours
  return `<mjml><mj-head><mj-attributes><mj-all font-family="Arial, Helvetica, sans-serif" /><mj-section background-color="${colour(c.background, '#ffffff')}" /><mj-text color="${colour(c.text, '#1a1a1a')}" font-size="16px" line-height="1.55" /></mj-attributes></mj-head><mj-body background-color="#f4f4f4" width="600px">${logoMjml(brand)}<mj-section padding="8px 32px"><mj-column><mj-text font-size="26px" font-weight="700" line-height="1.25" padding="0 0 12px">${escapeHtml(copy.heading)}</mj-text><mj-text padding="0">${escapeHtml(copy.body)}</mj-text></mj-column></mj-section><mj-section padding="16px 32px 24px"><mj-column><mj-button href="{shop_url}" background-color="${colour(c.button, '#1a1a1a')}" color="${colour(c.buttonText, '#ffffff')}" border-radius="6px" font-size="16px" font-weight="600" inner-padding="14px 28px">${escapeHtml(copy.button)}</mj-button></mj-column></mj-section>${socialMjml(brand)}${footerMjml(brand, copy)}</mj-body></mjml>`
}
