/**
 * Shopify orders CSV → NOrder. One row per line item with the order name
 * repeated; order-level columns are filled on the first row of each order.
 */
import { bool, cleanId, hasColumn, int, paise, readTable, tags } from './csv'
import type { Issue, NAddress, NOrder } from './types'

/** `#1001` → 1001; `WM-1001-IN` → 1001. Null when the name has no digits. */
export function orderNumberFrom(name: string): number | null {
  const digits = name.match(/\d+/g)
  if (!digits) return null
  const n = Number(digits.join(''))
  return Number.isSafeInteger(n) && n > 0 && n < 2_000_000_000 ? n : null
}

/** Shopify writes `2024-03-05 14:22:10 +0530`; Date needs the T and a colon in the offset. */
export function shopifyDate(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)\s*([+-]\d{2}):?(\d{2})$/.exec(v)
  const iso = m ? `${m[1]}T${m[2]}${m[3]}:${m[4]}` : v
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function parseOrdersCsv(text: string): { orders: NOrder[]; issues: Issue[] } {
  const table = readTable(text)
  const issues: Issue[] = []
  if (!hasColumn(table, 'name') || !hasColumn(table, 'lineitem name')) {
    return {
      orders: [],
      issues: [
        {
          resource: 'orders',
          row: 1,
          message: 'Expected Name and Lineitem name columns. In Shopify, export Orders as CSV.',
        },
      ],
    }
  }
  const byName = new Map<string, NOrder>()
  for (const row of table.rows) {
    const name = row.get('name')
    if (!name) {
      issues.push({ resource: 'orders', row: row.line, message: 'Row has no order name' })
      continue
    }
    let o = byName.get(name)
    if (!o) {
      const shipLine1 = row.get('shipping address1', 'shipping street')
      const shipping: NAddress | null = shipLine1
        ? {
            name: row.get('shipping name', 'billing name'),
            company: row.get('shipping company') || null,
            line1: shipLine1,
            line2: row.get('shipping address2') || null,
            city: row.get('shipping city'),
            province: row.get('shipping province name') || null,
            provinceCode: row.get('shipping province') || null,
            country: null,
            countryCode: row.get('shipping country') || null,
            zip: row.get('shipping zip').replace(/^'/, ''),
            phone: row.get('shipping phone', 'phone') || null,
          }
        : null
      o = {
        sourceId: cleanId(row.get('id')),
        name,
        number: orderNumberFrom(name),
        email: row.get('email').toLowerCase() || null,
        phone: row.get('phone', 'shipping phone', 'billing phone') || null,
        customerName: row.get('billing name', 'shipping name') || null,
        financialStatus: row.get('financial status').toLowerCase() || null,
        fulfillmentStatus: row.get('fulfillment status').toLowerCase() || null,
        currency: row.get('currency') || null,
        subtotalPaise: paise(row.get('subtotal')) ?? 0,
        shippingPaise: paise(row.get('shipping')) ?? 0,
        taxPaise: paise(row.get('taxes')) ?? 0,
        totalPaise: paise(row.get('total')) ?? 0,
        discountCode: row.get('discount code') || null,
        discountPaise: paise(row.get('discount amount')) ?? 0,
        refundedPaise: paise(row.get('refunded amount')) ?? 0,
        paymentMethod: row.get('payment method', 'payment gateway') || null,
        paymentReference: row.get('payment reference', 'payment id') || null,
        createdAt: shopifyDate(row.get('created at', 'processed at')),
        cancelledAt: shopifyDate(row.get('cancelled at')),
        tags: tags(row.get('tags')),
        note: row.get('notes', 'note') || null,
        shippingAddress: shipping,
        lines: [],
        row: row.line,
      }
      if (o.number === null) {
        issues.push({
          resource: 'orders',
          row: row.line,
          ref: name,
          message: 'Order name has no number; it gets the next free order number',
        })
      }
      byName.set(name, o)
    }
    const title = row.get('lineitem name')
    const quantity = int(row.get('lineitem quantity')) ?? 0
    if (!title || quantity <= 0) continue
    const lineStatus = row.get('lineitem fulfillment status').toLowerCase()
    o.lines.push({
      title,
      variantTitle: null,
      sku: cleanId(row.get('lineitem sku')),
      productHandle: null,
      quantity,
      unitPricePaise: paise(row.get('lineitem price')) ?? 0,
      fulfilledQuantity: lineStatus === 'fulfilled' ? quantity : 0,
      taxable: bool(row.get('lineitem taxable'), true),
    })
  }
  const orders = [...byName.values()].filter((o) => {
    if (o.lines.length > 0) return true
    issues.push({ resource: 'orders', row: o.row, ref: o.name, message: 'Order has no line items' })
    return false
  })
  return { orders, issues }
}
