/** SOURCE OF TRUTH: DOCUMENT_KINDS, DEFAULT_TEMPLATES, renderTemplate, packingSlipData,
 *   pickListData, invoiceData, printDocument, SAMPLE_ORDER
 * WHAT:  The store's printed documents (audit #164): Packing slip, Pick list and Invoice, each an
 *        HTML template with merge tags (`{{ order.number }}`, `{{#lines}}…{{/lines}}`), filled from
 *        an order (or several, for the pick list) and wrapped in one printable page.
 * WHY:   Pure, so the template editor's live preview, the print view and the tests run the same
 *        code in the browser and on the server. The GST invoice is not here: the GST invoices app
 *        owns it and keeps it compliant (only its branding and fields are editable, in the app).
 *
 * Merge tags follow Mustache's basic tags (MIT; the syntax only, no code copied): `{{ name }}`
 * prints a value HTML-escaped, `{{#name}}…{{/name}}` repeats for a list or shows when set,
 * `{{^name}}…{{/name}}` shows when empty. There is no raw (unescaped) tag, so order data can never
 * add markup. Templates print in a sandboxed frame with scripts off.
 */
import { formatInZone } from '@commerce/dates'
import { type Currency, DEFAULT_CURRENCY, formatMoney } from '@commerce/money'
import { z } from 'zod'
import { INDIAN_STATE_NAMES } from '../tax/states'

export const DOCUMENT_KINDS = ['packing_slip', 'pick_list', 'invoice'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/** The most a template may hold; a page of HTML and CSS is far below it. */
export const TEMPLATE_MAX_CHARS = 100_000

export const DocumentTemplateWriteSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  html: z.string().max(TEMPLATE_MAX_CHARS),
})
export type DocumentTemplateWrite = z.infer<typeof DocumentTemplateWriteSchema>

/* ----------------------------------------------------------------- renderer */

type Node =
  | { t: 'text'; v: string }
  | { t: 'var'; path: string }
  | { t: 'section'; path: string; inverted: boolean; kids: Node[] }

const TAG = /\{\{\s*([#^/]?)\s*([\w.]+)\s*\}\}/g

function parse(src: string): Node[] {
  const root: Node[] = []
  const open: { path: string; kids: Node[] }[] = []
  let into = root
  let last = 0
  for (const m of src.matchAll(TAG)) {
    const [whole, sigil, path] = m as unknown as [string, string, string]
    const at = m.index ?? 0
    if (at > last) into.push({ t: 'text', v: src.slice(last, at) })
    last = at + whole.length
    if (sigil === '#' || sigil === '^') {
      const node: Node = { t: 'section', path, inverted: sigil === '^', kids: [] }
      into.push(node)
      open.push({ path, kids: into })
      into = node.kids
    } else if (sigil === '/') {
      // Close the nearest open section with this name; a stray closing tag prints nothing.
      const i = open.map((o) => o.path).lastIndexOf(path)
      if (i >= 0) {
        into = open[i]?.kids ?? root
        open.length = i
      }
    } else {
      into.push({ t: 'var', path })
    }
  }
  if (last < src.length) into.push({ t: 'text', v: src.slice(last) })
  return root
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A dotted name, looked up from the innermost section outwards; `.` is the current item. */
function lookup(stack: readonly unknown[], path: string): unknown {
  if (path === '.') return stack.at(-1)
  const [head, ...rest] = path.split('.')
  for (let i = stack.length - 1; i >= 0; i--) {
    const ctx = stack[i]
    if (!isRecord(ctx) || !head || !(head in ctx)) continue
    let value: unknown = ctx[head]
    for (const key of rest) value = isRecord(value) ? value[key] : undefined
    return value
  }
  return undefined
}

const text = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : ''

const truthy = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== false && v !== ''

function renderNodes(nodes: readonly Node[], stack: unknown[]): string {
  let out = ''
  for (const n of nodes) {
    if (n.t === 'text') out += n.v
    else if (n.t === 'var') out += escapeHtml(text(lookup(stack, n.path)))
    else {
      const v = lookup(stack, n.path)
      if (n.inverted) {
        if (!truthy(v)) out += renderNodes(n.kids, stack)
      } else if (Array.isArray(v)) {
        for (const item of v) out += renderNodes(n.kids, [...stack, item])
      } else if (truthy(v)) {
        out += renderNodes(n.kids, isRecord(v) ? [...stack, v] : stack)
      }
    }
  }
  return out
}

/** Fill a template's merge tags from `data`. Unknown tags print nothing. */
export function renderTemplate(html: string, data: Record<string, unknown>): string {
  return renderNodes(parse(html), [data])
}

/* --------------------------------------------------------------------- data */

/** The order fields the documents read (the admin's order detail has all of them). */
export type DocOrder = {
  number: number
  placedAt: Date | string
  email: string | null
  phone: string | null
  customerNote?: string | null | undefined
  subtotalPaise: number
  shippingPaise: number
  discountPaise: number
  taxPaise: number
  totalPaise: number
  shippingRateName: string | null
  shippingAddress: {
    name: string
    line1: string
    line2: string | null
    city: string
    stateCode: string
    pincode: string
    phone: string | null
  } | null
  lines: {
    title: string | null
    variantTitle: string | null
    sku: string | null
    quantity: number
    unitPricePaise: number
  }[]
}

/** The store as printed in the header. */
export type DocStore = {
  name: string
  email: string | null
  phone: string | null
  address: string | null
  gstin: string | null
}

export type DocOptions = {
  /** The store's currency, the default currency when left out; amounts are in its minor unit. */
  currency?: Currency | undefined
  /** BCP 47 tag for dates and amounts, `en-IN` by default. */
  locale?: string | undefined
  timeZone?: string | undefined
}

const dateOf = (d: Date | string, o: DocOptions) =>
  formatInZone(
    d,
    { day: 'numeric', month: 'short', year: 'numeric' },
    {
      ...(o.locale ? { locale: o.locale } : {}),
      ...(o.timeZone ? { timeZone: o.timeZone } : {}),
    },
  )

/** "Default" is how a product without options names its only variant: not worth printing. */
const variantOf = (v: string | null) => (v && v !== 'Default' && v !== 'Default Title' ? v : '')

function lineData(l: DocOrder['lines'][number], money: (minor: number) => string) {
  return {
    title: l.title ?? '',
    variant: variantOf(l.variantTitle),
    sku: l.sku ?? '',
    quantity: l.quantity,
    price: money(l.unitPricePaise),
    total: money(l.unitPricePaise * l.quantity),
  }
}

function orderData(o: DocOrder, opts: DocOptions) {
  const money = (minor: number) => formatMoney(minor, opts.currency ?? DEFAULT_CURRENCY)
  const a = o.shippingAddress
  return {
    order: {
      number: `#${o.number}`,
      date: dateOf(o.placedAt, opts),
      email: o.email ?? '',
      phone: o.phone ?? '',
      note: o.customerNote ?? '',
      shippingMethod: o.shippingRateName ?? '',
      subtotal: money(o.subtotalPaise),
      shipping: money(o.shippingPaise),
      discount: o.discountPaise > 0 ? money(o.discountPaise) : '',
      tax: o.taxPaise > 0 ? money(o.taxPaise) : '',
      total: money(o.totalPaise),
      itemCount: o.lines.reduce((sum, l) => sum + l.quantity, 0),
    },
    shipTo: a
      ? {
          name: a.name,
          line1: a.line1,
          line2: a.line2 ?? '',
          city: a.city,
          state: INDIAN_STATE_NAMES[a.stateCode] ?? a.stateCode,
          pincode: a.pincode,
          phone: a.phone ?? '',
        }
      : null,
    lines: o.lines.map((l) => lineData(l, money)),
  }
}

export const packingSlipData = (o: DocOrder, store: DocStore, opts: DocOptions = {}) => ({
  store,
  ...orderData(o, opts),
})

export const invoiceData = packingSlipData

/**
 * The pick list for several orders: every item once, with the quantity to pick across all of
 * them and the orders it goes to, sorted by SKU then title so a picker walks the shelves once.
 */
export function pickListData(
  orders: readonly DocOrder[],
  store: DocStore,
  opts: DocOptions = {},
  now: Date = new Date(),
) {
  const items = new Map<
    string,
    { title: string; variant: string; sku: string; quantity: number; orders: string[] }
  >()
  for (const o of orders) {
    for (const l of o.lines) {
      const variant = variantOf(l.variantTitle)
      const key = [l.sku ?? '', l.title ?? '', variant].join('|')
      const item = items.get(key) ?? {
        title: l.title ?? '',
        variant,
        sku: l.sku ?? '',
        quantity: 0,
        orders: [],
      }
      item.quantity += l.quantity
      if (!item.orders.includes(`#${o.number}`)) item.orders.push(`#${o.number}`)
      items.set(key, item)
    }
  }
  const sorted = [...items.values()].sort(
    (a, b) => a.sku.localeCompare(b.sku) || a.title.localeCompare(b.title),
  )
  return {
    store,
    date: dateOf(now, opts),
    orderCount: orders.length,
    orders: orders.map((o) => ({ number: `#${o.number}` })),
    itemCount: sorted.reduce((sum, i) => sum + i.quantity, 0),
    items: sorted.map((i) => ({ ...i, orders: i.orders.join(', ') })),
  }
}

/* -------------------------------------------------------------------- pages */

/**
 * One printable HTML document: each filled template on its own page. Base styles keep the
 * page black on white; a template's own `<style>` wins over them.
 */
export function printDocument(bodies: readonly string[], title: string): string {
  const pages = bodies.map((b) => `<section class="doc-page">${b}</section>`).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{margin:0;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;background:#fff}
.doc-page{padding:24px;break-after:page}.doc-page:last-child{break-after:auto}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #ddd;vertical-align:top}
.right{text-align:right}h1,h2,h3{margin:0 0 8px}
@page{margin:12mm}
</style></head><body>${pages}</body></html>`
}

/* ---------------------------------------------------------------- defaults */

const PACKING_SLIP = `<header style="display:flex;justify-content:space-between;gap:24px">
  <div>
    <h1>{{ store.name }}</h1>
    {{#store.address}}<p>{{ store.address }}</p>{{/store.address}}
  </div>
  <div class="right">
    <h2>Packing slip</h2>
    <p>Order {{ order.number }}<br>{{ order.date }}</p>
  </div>
</header>
{{#shipTo}}
<section style="margin-top:16px">
  <strong>Ship to</strong>
  <p>{{ name }}<br>{{ line1 }}{{#line2}}<br>{{ line2 }}{{/line2}}<br>{{ city }}, {{ state }} {{ pincode }}{{#phone}}<br>{{ phone }}{{/phone}}</p>
</section>
{{/shipTo}}
<table style="margin-top:16px">
  <thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th></tr></thead>
  <tbody>
    {{#lines}}<tr><td>{{ title }}{{#variant}}, {{ variant }}{{/variant}}</td><td>{{ sku }}</td><td class="right">{{ quantity }}</td></tr>{{/lines}}
  </tbody>
</table>
{{#order.note}}<p style="margin-top:16px"><strong>Note:</strong> {{ order.note }}</p>{{/order.note}}
<p style="margin-top:24px">Thank you for shopping with {{ store.name }}.</p>`

const PICK_LIST = `<header style="display:flex;justify-content:space-between;gap:24px">
  <h1>Pick list</h1>
  <p class="right">{{ store.name }}<br>{{ date }} · {{ orderCount }} orders · {{ itemCount }} items</p>
</header>
<table style="margin-top:16px">
  <thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th><th>Orders</th></tr></thead>
  <tbody>
    {{#items}}<tr><td>{{ title }}{{#variant}}, {{ variant }}{{/variant}}</td><td>{{ sku }}</td><td class="right">{{ quantity }}</td><td>{{ orders }}</td></tr>{{/items}}
  </tbody>
</table>`

const INVOICE = `<header style="display:flex;justify-content:space-between;gap:24px">
  <div>
    <h1>{{ store.name }}</h1>
    {{#store.address}}<p>{{ store.address }}</p>{{/store.address}}
    {{#store.gstin}}<p>GSTIN {{ store.gstin }}</p>{{/store.gstin}}
  </div>
  <div class="right">
    <h2>Invoice</h2>
    <p>Order {{ order.number }}<br>{{ order.date }}</p>
  </div>
</header>
{{#shipTo}}
<section style="margin-top:16px">
  <strong>Bill to</strong>
  <p>{{ name }}<br>{{ line1 }}{{#line2}}<br>{{ line2 }}{{/line2}}<br>{{ city }}, {{ state }} {{ pincode }}</p>
</section>
{{/shipTo}}
<table style="margin-top:16px">
  <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
  <tbody>
    {{#lines}}<tr><td>{{ title }}{{#variant}}, {{ variant }}{{/variant}}</td><td class="right">{{ quantity }}</td><td class="right">{{ price }}</td><td class="right">{{ total }}</td></tr>{{/lines}}
  </tbody>
</table>
<table style="margin-top:12px;width:auto;margin-left:auto">
  <tr><td>Subtotal</td><td class="right">{{ order.subtotal }}</td></tr>
  {{#order.discount}}<tr><td>Discount</td><td class="right">-{{ order.discount }}</td></tr>{{/order.discount}}
  <tr><td>Shipping</td><td class="right">{{ order.shipping }}</td></tr>
  {{#order.tax}}<tr><td>Tax</td><td class="right">{{ order.tax }}</td></tr>{{/order.tax}}
  <tr><td><strong>Total</strong></td><td class="right"><strong>{{ order.total }}</strong></td></tr>
</table>`

export const DEFAULT_TEMPLATES: Readonly<Record<DocumentKind, string>> = {
  packing_slip: PACKING_SLIP,
  pick_list: PICK_LIST,
  invoice: INVOICE,
}

/** The merge tags each template can use, as the editor lists them. */
export const DOCUMENT_MERGE_TAGS: Readonly<Record<DocumentKind, readonly string[]>> = {
  packing_slip: [
    '{{ store.name }}',
    '{{ store.address }}',
    '{{ store.phone }}',
    '{{ store.email }}',
    '{{ order.number }}',
    '{{ order.date }}',
    '{{ order.note }}',
    '{{ order.shippingMethod }}',
    '{{ order.itemCount }}',
    '{{#shipTo}} … {{/shipTo}}: name, line1, line2, city, state, pincode, phone',
    '{{#lines}} … {{/lines}}: title, variant, sku, quantity, price, total',
  ],
  pick_list: [
    '{{ store.name }}',
    '{{ date }}',
    '{{ orderCount }}',
    '{{ itemCount }}',
    '{{#items}} … {{/items}}: title, variant, sku, quantity, orders',
    '{{#orders}} … {{/orders}}: number',
  ],
  invoice: [
    '{{ store.name }}',
    '{{ store.address }}',
    '{{ store.gstin }}',
    '{{ order.number }}',
    '{{ order.date }}',
    '{{ order.subtotal }}',
    '{{ order.discount }}',
    '{{ order.shipping }}',
    '{{ order.tax }}',
    '{{ order.total }}',
    '{{#shipTo}} … {{/shipTo}}: name, line1, line2, city, state, pincode, phone',
    '{{#lines}} … {{/lines}}: title, variant, sku, quantity, price, total',
  ],
}

/* ------------------------------------------------------------------- sample */

/** The order the editor previews with: made up, never a real customer. */
export const SAMPLE_ORDER: DocOrder = {
  number: 1042,
  placedAt: '2026-10-30T10:15:00+05:30',
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  customerNote: 'Please leave it with the guard.',
  subtotalPaise: 248_900,
  shippingPaise: 4900,
  discountPaise: 10_000,
  taxPaise: 0,
  totalPaise: 243_800,
  shippingRateName: 'Standard',
  shippingAddress: {
    name: 'Asha Rao',
    line1: '12, 4th Cross, Indiranagar',
    line2: 'Near the metro station',
    city: 'Bengaluru',
    stateCode: 'KA',
    pincode: '560038',
    phone: '+91 98765 43210',
  },
  lines: [
    {
      title: 'Glass mousepad',
      variantTitle: 'Black / XL',
      sku: 'GP-XL-BLK',
      quantity: 1,
      unitPricePaise: 199_900,
    },
    {
      title: 'Mouse skates',
      variantTitle: 'Default',
      sku: 'SK-01',
      quantity: 2,
      unitPricePaise: 24_500,
    },
  ],
}

export const SAMPLE_STORE: DocStore = {
  name: 'Your store',
  email: 'hello@example.com',
  phone: '+91 80000 00000',
  address: '1 MG Road, Bengaluru, Karnataka 560001',
  gstin: '29ABCDE1234F1Z5',
}

/** The filled document for one kind from the sample order, for the editor's live preview. */
export function samplePreview(kind: DocumentKind, html: string, store: DocStore): string {
  const data =
    kind === 'pick_list'
      ? pickListData(
          [SAMPLE_ORDER, { ...SAMPLE_ORDER, number: 1043 }],
          store,
          {},
          new Date(SAMPLE_ORDER.placedAt),
        )
      : packingSlipData(SAMPLE_ORDER, store)
  return printDocument([renderTemplate(html, data)], kind)
}
