/** SOURCE OF TRUTH: customer data export — WHAT: everything the store holds about one customer (profile, marketing consent and its history, cookie choices, saved addresses, orders with their lines and delivery address, data requests) as JSON, and the same flattened to CSV / WHY: the DPDP Act gives a shopper the right to a summary of their personal data; one builder keeps the admin download and any later self-service download identical */
import {
  address,
  cookieConsent,
  customer,
  customerAddress,
  dataRequest,
  marketingConsentEvent,
  order,
  orderLine,
  store,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { type PrivacyActor, recordPrivacyEvent } from './audit'
import type { ExportFormat } from './client'

type ExportAddress = {
  name: string
  line1: string
  line2: string | null
  city: string
  stateCode: string
  pincode: string
  country: string
  phone: string
}

export type CustomerDataExport = {
  exportedAt: string
  store: string
  profile: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    gstin: string | null
    businessName: string | null
    tags: string[]
    note: string | null
    createdAt: string
    anonymisedAt: string | null
  }
  marketingConsent: {
    email: boolean
    whatsapp: boolean
    sms: boolean
    unsubscribedAt: string | null
    history: { channel: string; granted: boolean; source: string; at: string }[]
  }
  cookieChoices: { analytics: boolean; marketing: boolean; bannerVersion: number; at: string }[]
  addresses: (ExportAddress & { isDefault: boolean })[]
  orders: {
    number: number
    placedAt: string
    status: string
    paymentStatus: string
    fulfillmentStatus: string
    total: string
    email: string | null
    phone: string | null
    paymentMethod: string | null
    gstin: string | null
    businessName: string | null
    note: string | null
    shippingAddress: ExportAddress | null
    lines: { title: string; variant: string | null; quantity: number; unitPrice: string }[]
  }[]
  dataRequests: { number: number; kind: string; status: string; createdAt: string }[]
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null)

/** Everything held about one customer. Null when the customer does not exist in this store. */
async function buildCustomerExport(
  ctx: StoreContext,
  customerId: string,
  secret: string,
  now = new Date(),
): Promise<CustomerDataExport | null> {
  const [cu] = await ctx.tx.select().from(customer).where(eq(customer.id, customerId))
  if (!cu) return null
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  // Every store sells in rupees today; the column exists for later.
  const money = (paise: number) => formatMoney(paise, 'INR')

  const history = await ctx.tx
    .select()
    .from(marketingConsentEvent)
    .where(eq(marketingConsentEvent.customerId, customerId))
    .orderBy(asc(marketingConsentEvent.createdAt))
  const cookies = await ctx.tx
    .select()
    .from(cookieConsent)
    .where(eq(cookieConsent.customerId, customerId))
    .orderBy(asc(cookieConsent.createdAt))
  const book = await ctx.tx
    .select()
    .from(customerAddress)
    .where(eq(customerAddress.customerId, customerId))
    .orderBy(desc(customerAddress.isDefault), asc(customerAddress.createdAt))
  const orders = await ctx.tx
    .select({ order, shipTo: address })
    .from(order)
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .where(eq(order.customerId, customerId))
    .orderBy(asc(order.placedAt))
  const lines = orders.length
    ? await ctx.tx
        .select()
        .from(orderLine)
        .where(
          inArray(
            orderLine.orderId,
            orders.map((o) => o.order.id),
          ),
        )
        .orderBy(asc(orderLine.id))
    : []
  const requests = await ctx.tx
    .select()
    .from(dataRequest)
    .where(eq(dataRequest.customerId, customerId))
    .orderBy(asc(dataRequest.createdAt))

  const toAddress = (a: typeof address.$inferSelect | null): ExportAddress | null =>
    a
      ? {
          name: a.name,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          stateCode: a.stateCode,
          pincode: a.pincode,
          country: a.country,
          phone: a.phone,
        }
      : null

  return {
    exportedAt: now.toISOString(),
    store: s?.name ?? '',
    profile: {
      id: cu.id,
      name: cu.name,
      email: cu.email,
      phone: decryptCustomerPhone(cu.phone, secret),
      gstin: cu.gstin,
      businessName: cu.businessName,
      tags: cu.tags,
      note: cu.note,
      createdAt: cu.createdAt.toISOString(),
      anonymisedAt: iso(cu.anonymisedAt),
    },
    marketingConsent: {
      email: cu.acceptsMarketing,
      whatsapp: cu.acceptsWhatsapp,
      sms: cu.acceptsSms,
      unsubscribedAt: iso(cu.unsubscribedAt),
      history: history.map((h) => ({
        channel: h.channel,
        granted: h.granted,
        source: h.source,
        at: h.createdAt.toISOString(),
      })),
    },
    cookieChoices: cookies.map((c) => ({
      analytics: c.analytics,
      marketing: c.marketing,
      bannerVersion: c.bannerVersion,
      at: c.createdAt.toISOString(),
    })),
    addresses: book.map((a) => ({
      name: a.name,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      stateCode: a.stateCode,
      pincode: a.pincode,
      country: a.country,
      phone: a.phone,
      isDefault: a.isDefault,
    })),
    orders: orders.map(({ order: o, shipTo }) => ({
      number: o.number,
      placedAt: o.placedAt.toISOString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      total: money(o.totalPaise),
      email: o.email,
      phone: o.phone,
      paymentMethod: o.paymentMethod,
      gstin: o.buyerGstin,
      businessName: o.buyerBusinessName,
      note: o.customerNote,
      shippingAddress: toAddress(shipTo),
      lines: lines
        .filter((l) => l.orderId === o.id)
        .map((l) => ({
          title: l.title ?? '',
          variant: l.variantTitle,
          quantity: l.quantity,
          unitPrice: money(l.unitPricePaise),
        })),
    })),
    dataRequests: requests.map((r) => ({
      number: r.number,
      kind: r.kind,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

/**
 * One CSV cell. Quoted when it holds a comma, quote or line break; a leading
 * `=`, `+`, `-` or `@` gets an apostrophe so a spreadsheet never runs it as a formula.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = typeof value === 'string' ? value : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

const row = (cells: unknown[]) => cells.map(csvCell).join(',')

/**
 * The export as one CSV a spreadsheet opens: a section title, then a small
 * table per section (profile, consent, addresses, orders one row per line).
 */
function customerExportToCsv(data: CustomerDataExport): string {
  const out: string[] = []
  const section = (title: string, header: string[], rows: unknown[][]) => {
    if (out.length) out.push('')
    out.push(row([title]), row(header), ...rows.map(row))
  }
  const p = data.profile
  section(
    'Profile',
    ['Field', 'Value'],
    [
      ['Name', p.name],
      ['Email', p.email],
      ['Phone', p.phone],
      ['GSTIN', p.gstin],
      ['Business name', p.businessName],
      ['Tags', p.tags.join('; ')],
      ['Note', p.note],
      ['Customer since', p.createdAt],
      ['Store', data.store],
      ['Exported at', data.exportedAt],
    ],
  )
  const m = data.marketingConsent
  section(
    'Marketing consent',
    ['Channel', 'Allowed', 'Source', 'When'],
    [
      ['email', m.email, '', ''],
      ['whatsapp', m.whatsapp, '', ''],
      ['sms', m.sms, '', ''],
      ...m.history.map((h) => [h.channel, h.granted, h.source, h.at]),
    ],
  )
  section(
    'Cookie choices',
    ['Analytics', 'Marketing', 'Banner version', 'When'],
    data.cookieChoices.map((c) => [c.analytics, c.marketing, c.bannerVersion, c.at]),
  )
  section(
    'Addresses',
    ['Name', 'Line 1', 'Line 2', 'City', 'State code', 'PIN code', 'Country', 'Phone', 'Default'],
    data.addresses.map((a) => [
      a.name,
      a.line1,
      a.line2,
      a.city,
      a.stateCode,
      a.pincode,
      a.country,
      a.phone,
      a.isDefault,
    ]),
  )
  section(
    'Orders',
    [
      'Order',
      'Placed at',
      'Status',
      'Payment',
      'Delivery',
      'Total',
      'Email',
      'Phone',
      'GSTIN',
      'Ship to',
      'Item',
      'Variant',
      'Quantity',
      'Unit price',
    ],
    data.orders.flatMap((o) => {
      const shipTo = o.shippingAddress
        ? [
            o.shippingAddress.name,
            o.shippingAddress.line1,
            o.shippingAddress.city,
            o.shippingAddress.pincode,
          ]
            .filter(Boolean)
            .join(', ')
        : ''
      const head = [
        `#${o.number}`,
        o.placedAt,
        o.status,
        o.paymentStatus,
        o.fulfillmentStatus,
        o.total,
        o.email,
        o.phone,
        o.gstin,
        shipTo,
      ]
      return o.lines.length
        ? o.lines.map((l) => [...head, l.title, l.variant, l.quantity, l.unitPrice])
        : [[...head, '', '', '', '']]
    }),
  )
  section(
    'Data requests',
    ['Request', 'Kind', 'Status', 'Made at'],
    data.dataRequests.map((r) => [`#${r.number}`, r.kind, r.status, r.createdAt]),
  )
  return `${out.join('\r\n')}\r\n`
}

export type ExportFile = { filename: string; contentType: string; body: string }

/**
 * Build the download and note it in the audit trail (who took a copy of whose
 * data, in which format, for which request). Null for an unknown customer.
 */
export async function exportCustomerData(
  ctx: StoreContext,
  input: {
    customerId: string
    format: ExportFormat
    dataRequestId?: string | null | undefined
    secret: string
    actor: PrivacyActor
    now?: Date | undefined
  },
): Promise<ExportFile | null> {
  const now = input.now ?? new Date()
  const data = await buildCustomerExport(ctx, input.customerId, input.secret, now)
  if (!data) return null
  await recordPrivacyEvent(ctx, {
    action: 'export.downloaded',
    actor: input.actor,
    customerId: input.customerId,
    dataRequestId: input.dataRequestId ?? null,
    detail: { format: input.format, orders: data.orders.length, addresses: data.addresses.length },
    at: now,
  })
  const stamp = now.toISOString().slice(0, 10)
  return input.format === 'json'
    ? {
        filename: `customer-data-${stamp}.json`,
        contentType: 'application/json',
        body: `${JSON.stringify(data, null, 2)}\n`,
      }
    : {
        filename: `customer-data-${stamp}.csv`,
        contentType: 'text/csv',
        body: customerExportToCsv(data),
      }
}
