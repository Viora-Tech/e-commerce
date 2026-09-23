import { z } from 'zod'

/**
 * The block-based email composer (Shopify Email style): a campaign or an
 * automation step is a list of blocks rendered to email-safe HTML. Pure, so
 * the admin's live preview renders exactly what the worker sends.
 */

const Id = z.string().trim().min(1).max(40)
const Url = z.string().trim().max(2000)
const Text = (max: number) => z.string().max(max)

export const EmailBlockSchema = z.discriminatedUnion('type', [
  z.object({
    id: Id,
    type: z.literal('header'),
    logoUrl: Url.optional(),
  }),
  z.object({
    id: Id,
    type: z.literal('text'),
    heading: Text(200).optional(),
    text: Text(5000).default(''),
    align: z.enum(['left', 'center']).default('left'),
  }),
  z.object({
    id: Id,
    type: z.literal('image'),
    url: Url.default(''),
    alt: Text(200).default(''),
    href: Url.optional(),
  }),
  z.object({
    id: Id,
    type: z.literal('button'),
    label: Text(80).default(''),
    url: Url.default(''),
  }),
  z.object({
    id: Id,
    type: z.literal('products'),
    heading: Text(200).optional(),
    items: z
      .array(
        z.object({
          id: z.string().max(40),
          title: Text(200),
          priceLabel: Text(40),
          imageUrl: Url.nullable().optional(),
          handle: Text(200),
        }),
      )
      .max(6)
      .default([]),
  }),
  z.object({
    id: Id,
    type: z.literal('discount'),
    code: Text(60).default(''),
    heading: Text(200).optional(),
    note: Text(300).optional(),
  }),
  /** The shopper's basket; only meaningful in cart and checkout automations. */
  z.object({ id: Id, type: z.literal('cart') }),
  z.object({ id: Id, type: z.literal('divider') }),
])
export type EmailBlock = z.infer<typeof EmailBlockSchema>
export type EmailBlockType = EmailBlock['type']
export const EmailBlocksSchema = z.array(EmailBlockSchema).max(40)

export const EMAIL_BLOCK_TYPES: EmailBlockType[] = [
  'header',
  'text',
  'image',
  'button',
  'products',
  'discount',
  'cart',
  'divider',
]

/** Merge tags a merchant can type into text, subjects, URLs and WhatsApp variables. */
export const MERGE_TAGS = [
  'first_name',
  'name',
  'store_name',
  'shop_url',
  'discount_code',
  'checkout_url',
  'cart_total',
  'order_number',
] as const
export type MergeTag = (typeof MERGE_TAGS)[number]
export type MergeValues = Partial<Record<MergeTag, string>>

/** Replaces `{tag}` for known tags; unknown braces are left alone so prices like {x} survive. */
export function applyMergeTags(input: string, values: MergeValues): string {
  return input.replace(/\{([a-z_]+)\}/g, (whole, tag: string) =>
    (MERGE_TAGS as readonly string[]).includes(tag) ? (values[tag as MergeTag] ?? '') : whole,
  )
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only http(s) and mailto links reach an email; anything else renders as plain text. */
export function safeUrl(url: string): string | null {
  const t = url.trim()
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t)) return t
  return null
}

export type EmailCartLine = {
  title: string
  quantity: number
  priceLabel: string
  imageUrl?: string | null
}

export type EmailRenderContext = {
  storeName: string
  /** Postal address in the footer; bulk mail law (and Gmail) expects one. */
  storeAddress?: string | undefined
  shopUrl: string
  accent?: string | undefined
  previewText?: string | undefined
  merge: MergeValues
  cart?: { lines: EmailCartLine[]; totalLabel: string } | undefined
  /** Absent in previews; present on every real marketing send. */
  unsubscribeUrl?: string | undefined
  /** 1x1 open pixel. */
  openPixelUrl?: string | undefined
  /** Rewrites a link for click tracking; identity in previews. */
  trackLink?: ((url: string) => string) | undefined
  labels?: Partial<EmailLabels> | undefined
}

export type EmailLabels = {
  unsubscribe: string
  reason: (store: string) => string
  cartHeading: string
  cartTotal: string
  quantity: (n: number) => string
  discountHeading: string
  shopNow: string
}

const DEFAULT_LABELS: EmailLabels = {
  unsubscribe: 'Unsubscribe',
  reason: (store) => `You are receiving this because you subscribed to emails from ${store}.`,
  cartHeading: 'Your basket',
  cartTotal: 'Subtotal',
  quantity: (n) => `Qty ${n}`,
  discountHeading: 'Your code',
  shopNow: 'Shop now',
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#1a1a1a'
const MUTED = '#6b6b6b'
const LINE = '#e6e6e6'

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => escapeHtml(p).replace(/\n/g, '<br>'))

function row(inner: string, padding = '0 32px 24px'): string {
  return `<tr><td style="padding:${padding}">${inner}</td></tr>`
}

function blockHtml(block: EmailBlock, ctx: EmailRenderContext, labels: EmailLabels): string {
  const accent = ctx.accent || INK
  const merge = (s: string) => applyMergeTags(s, ctx.merge)
  const link = (url: string) => {
    const safe = safeUrl(merge(url))
    if (!safe) return null
    return ctx.trackLink ? ctx.trackLink(safe) : safe
  }
  switch (block.type) {
    case 'header': {
      const logo = block.logoUrl ? safeUrl(block.logoUrl) : null
      const inner = logo
        ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(ctx.storeName)}" height="40" style="display:block;height:40px;width:auto;border:0">`
        : `<span style="font-size:20px;font-weight:700;letter-spacing:-0.01em;color:${INK}">${escapeHtml(ctx.storeName)}</span>`
      const home = link(ctx.shopUrl)
      return row(
        home ? `<a href="${escapeHtml(home)}" style="text-decoration:none">${inner}</a>` : inner,
        '28px 32px 24px',
      )
    }
    case 'text': {
      const align = block.align === 'center' ? 'center' : 'left'
      const heading = block.heading
        ? `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:700;color:${INK}">${escapeHtml(merge(block.heading))}</h1>`
        : ''
      const body = paragraphs(merge(block.text))
        .map(
          (p) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:${INK}">${p}</p>`,
        )
        .join('')
      return row(`<div style="text-align:${align}">${heading}${body}</div>`)
    }
    case 'image': {
      const src = safeUrl(block.url)
      if (!src) return ''
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px">`
      const href = block.href ? link(block.href) : null
      return row(href ? `<a href="${escapeHtml(href)}">${img}</a>` : img)
    }
    case 'button': {
      const href = link(block.url)
      if (!href || !block.label.trim()) return ''
      return row(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td style="background:${escapeHtml(accent)};border-radius:6px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(merge(block.label))}</a></td></tr></table>`,
      )
    }
    case 'products': {
      if (block.items.length === 0) return ''
      const heading = block.heading
        ? `<h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:${INK}">${escapeHtml(merge(block.heading))}</h2>`
        : ''
      const cells = block.items.map((p) => {
        const href = link(
          `${ctx.shopUrl.replace(/\/$/, '')}/products/${encodeURIComponent(p.handle)}`,
        )
        const img = p.imageUrl && safeUrl(p.imageUrl)
        return `<td width="50%" valign="top" style="padding:0 8px 16px"><a href="${escapeHtml(href ?? '#')}" style="text-decoration:none;color:${INK}">${
          img
            ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}" width="252" style="display:block;width:100%;height:auto;border:0;border-radius:8px;margin-bottom:8px">`
            : ''
        }<span style="display:block;font-size:14px;font-weight:600">${escapeHtml(p.title)}</span><span style="display:block;font-size:14px;color:${MUTED};margin-top:2px">${escapeHtml(p.priceLabel)}</span></a></td>`
      })
      const rows: string[] = []
      for (let i = 0; i < cells.length; i += 2) {
        rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`)
      }
      return row(
        `${heading}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -8px">${rows.join('')}</table>`,
      )
    }
    case 'discount': {
      const code = merge(block.code).trim()
      if (!code) return ''
      const heading = escapeHtml(merge(block.heading || labels.discountHeading))
      const note = block.note
        ? `<p style="margin:8px 0 0;font-size:14px;color:${MUTED}">${escapeHtml(merge(block.note))}</p>`
        : ''
      return row(
        `<div style="border:1px dashed ${escapeHtml(accent)};border-radius:8px;padding:20px;text-align:center"><p style="margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${MUTED}">${heading}</p><p style="margin:0;font-size:24px;font-weight:700;letter-spacing:0.06em;color:${INK}">${escapeHtml(code)}</p>${note}</div>`,
      )
    }
    case 'cart': {
      const cart = ctx.cart
      if (!cart || cart.lines.length === 0) return ''
      const lines = cart.lines
        .map((l) => {
          const img = l.imageUrl && safeUrl(l.imageUrl)
          return `<tr><td width="64" style="padding:8px 0">${
            img
              ? `<img src="${escapeHtml(img)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:6px;border:0">`
              : ''
          }</td><td style="padding:8px 12px;font-size:14px;color:${INK}">${escapeHtml(l.title)}<br><span style="color:${MUTED}">${escapeHtml(labels.quantity(l.quantity))}</span></td><td align="right" style="padding:8px 0;font-size:14px;color:${INK};white-space:nowrap">${escapeHtml(l.priceLabel)}</td></tr>`
        })
        .join('')
      return row(
        `<h2 style="margin:0 0 8px;font-size:18px;font-weight:700;color:${INK}">${escapeHtml(labels.cartHeading)}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE}">${lines}</table><p style="margin:12px 0 0;font-size:15px;text-align:right;color:${INK}">${escapeHtml(labels.cartTotal)}: <strong>${escapeHtml(cart.totalLabel)}</strong></p>`,
      )
    }
    case 'divider':
      return row(`<div style="border-top:1px solid ${LINE};font-size:0;line-height:0">&nbsp;</div>`)
  }
}

function blockText(block: EmailBlock, ctx: EmailRenderContext, labels: EmailLabels): string {
  const merge = (s: string) => applyMergeTags(s, ctx.merge)
  switch (block.type) {
    case 'header':
      return ctx.storeName
    case 'text':
      return [block.heading ? merge(block.heading) : '', merge(block.text)]
        .filter(Boolean)
        .join('\n\n')
    case 'image':
      return block.alt
    case 'button': {
      const url = safeUrl(merge(block.url))
      return url && block.label
        ? `${merge(block.label)}: ${ctx.trackLink ? ctx.trackLink(url) : url}`
        : ''
    }
    case 'products':
      return block.items
        .map(
          (p) =>
            `${p.title} (${p.priceLabel}) ${ctx.shopUrl.replace(/\/$/, '')}/products/${p.handle}`,
        )
        .join('\n')
    case 'discount':
      return block.code
        ? `${merge(block.heading || labels.discountHeading)}: ${merge(block.code)}`
        : ''
    case 'cart':
      return ctx.cart
        ? [
            ...ctx.cart.lines.map((l) => `${l.quantity} x ${l.title}  ${l.priceLabel}`),
            `${labels.cartTotal}: ${ctx.cart.totalLabel}`,
          ].join('\n')
        : ''
    case 'divider':
      return '---'
  }
}

/** Email-safe HTML and a plain-text alternative for a list of blocks. */
export function renderMarketingEmail(
  blocks: EmailBlock[],
  input: EmailRenderContext,
): { html: string; text: string } {
  // The store name and shop URL are always known, so their tags never render empty.
  const ctx = {
    ...input,
    merge: { store_name: input.storeName, shop_url: input.shopUrl, ...input.merge },
  }
  const labels = { ...DEFAULT_LABELS, ...ctx.labels }
  const body = blocks.map((b) => blockHtml(b, ctx, labels)).join('')
  const preview = ctx.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(applyMergeTags(ctx.previewText, ctx.merge))}${'&#8199;&#65279;&#847; '.repeat(40)}</div>`
    : ''
  const unsubscribe = ctx.unsubscribeUrl
    ? ` <a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">${escapeHtml(labels.unsubscribe)}</a>`
    : ''
  const footer = `<tr><td style="padding:24px 32px 32px;border-top:1px solid ${LINE};font-size:12px;line-height:1.5;color:${MUTED}">${escapeHtml(labels.reason(ctx.storeName))}${unsubscribe}${
    ctx.storeAddress ? `<br>${escapeHtml(ctx.storeName)}, ${escapeHtml(ctx.storeAddress)}` : ''
  }</td></tr>`
  const pixel = ctx.openPixelUrl
    ? `<img src="${escapeHtml(ctx.openPixelUrl)}" alt="" width="1" height="1" style="display:block;border:0;width:1px;height:1px">`
    : ''
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:${FONT}">${preview}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px">${body}${footer}</table></td></tr></table>${pixel}</body></html>`
  const textParts = blocks.map((b) => blockText(b, ctx, labels)).filter(Boolean)
  const textFooter = [
    labels.reason(ctx.storeName),
    ctx.unsubscribeUrl ? `${labels.unsubscribe}: ${ctx.unsubscribeUrl}` : '',
    ctx.storeAddress ?? '',
  ]
    .filter(Boolean)
    .join('\n')
  return { html, text: `${textParts.join('\n\n')}\n\n--\n${textFooter}` }
}

/** A new block of the given type with sensible starting content. */
export function newEmailBlock(type: EmailBlockType, id: string): EmailBlock {
  switch (type) {
    case 'header':
      return { id, type }
    case 'text':
      return { id, type, heading: '', text: '', align: 'left' }
    case 'image':
      return { id, type, url: '', alt: '' }
    case 'button':
      return { id, type, label: 'Shop now', url: '{shop_url}' }
    case 'products':
      return { id, type, heading: '', items: [] }
    case 'discount':
      return { id, type, code: '', heading: '', note: '' }
    case 'cart':
      return { id, type }
    case 'divider':
      return { id, type }
  }
}

/** Parses stored blocks, dropping any that no longer validate rather than failing the send. */
export function parseEmailBlocks(raw: unknown): EmailBlock[] {
  if (!Array.isArray(raw)) return []
  const out: EmailBlock[] = []
  for (const b of raw) {
    const r = EmailBlockSchema.safeParse(b)
    if (r.success) out.push(r.data)
  }
  return out
}
