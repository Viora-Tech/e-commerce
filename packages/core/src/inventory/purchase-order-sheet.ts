/**
 * SOURCE OF TRUTH: purchase order PDF data + "Email to supplier"
 * WHAT:  `loadPurchaseOrderSheet` reads one order into the plain `PurchaseOrderSheet` the PDF
 *        prints; `emailPurchaseOrder` sends that PDF to the supplier through the store's own
 *        email channel (its verified sender, else the platform address with Reply-To set to
 *        the store), optionally marking a draft ordered in the same transaction.
 * WHY:   Suppliers get a proper purchase order instead of a screenshot. The PDF renderer lives
 *        in `@commerce/invoices`, which core cannot import, so callers pass `renderPdf`.
 * WHERE: API `purchaseOrders.pdf` / `purchaseOrders.email`; admin purchase order page.
 */
import {
  location,
  notification,
  product,
  purchaseOrder,
  purchaseOrderLine,
  type StoreTx,
  store,
  supplier,
  variant,
} from '@commerce/db'
import type { NotificationChannel, TemplateData } from '@commerce/notifications'
import { asc, eq } from 'drizzle-orm'
import { StoreAddressSchema } from '../settings/general'
import { gstState } from '../tax/gstin'
import { documentRegistration } from '../tax/origin'
import { InventoryError } from './levels'
import {
  formatPurchaseAmount,
  type PoSheetParty,
  type PurchaseOrderSheet,
  poDateLabel,
  poFilename,
  poNumberLabel,
} from './po-sheet'
import { markOrdered } from './purchase-orders'
import { type EmailPurchaseOrderInput, EmailPurchaseOrderSchema } from './schemas'

type AddressParts = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  /** A two-letter code or a full state name. */
  state?: string | null
  pincode?: string | null
}

/** Street lines, then "City, State, PIN"; blanks dropped. */
function addressLines(a: AddressParts): string[] {
  const state = gstState(a.state)?.name ?? a.state
  const cityLine = [a.city, state, a.pincode].filter(Boolean).join(', ')
  return [a.line1, a.line2, cityLine].filter((l): l is string => Boolean(l?.trim()))
}

/** "Pad / Black", or just "Pad" for a product with one variant. */
function lineTitle(productTitle: string, variantTitle: string): string {
  return variantTitle && variantTitle !== 'Default' && variantTitle !== 'Default Title'
    ? `${productTitle} / ${variantTitle}`
    : productTitle
}

/**
 * Everything the printed purchase order shows. The buyer is the GST registration the
 * destination location receives under (its input credit), else the store's default
 * registration, else the store's own name, GSTIN and address from Settings → General.
 */
export async function loadPurchaseOrderSheet(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<PurchaseOrderSheet> {
  const [po] = await tx.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
  if (!po) throw new InventoryError('PO_NOT_FOUND', 'Purchase order not found', { storeId })
  const lines = await tx
    .select({
      variantId: purchaseOrderLine.variantId,
      quantity: purchaseOrderLine.quantity,
      unitPriceMinor: purchaseOrderLine.unitPriceMinor,
      hsnCode: purchaseOrderLine.hsnCode,
      sku: variant.sku,
      variantTitle: variant.title,
      productTitle: product.title,
    })
    .from(purchaseOrderLine)
    .innerJoin(variant, eq(variant.id, purchaseOrderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(purchaseOrderLine.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderLine.id))
  const [s] = await tx
    .select({
      name: store.name,
      timezone: store.timezone,
      address: store.address,
      gstin: store.gstin,
      email: store.contactEmail,
      phone: store.contactPhone,
    })
    .from(store)
    .where(eq(store.id, storeId))
  const [loc] = await tx.select().from(location).where(eq(location.id, po.locationId))
  const [sup] = po.supplierId
    ? await tx.select().from(supplier).where(eq(supplier.id, po.supplierId))
    : []
  const registration = await documentRegistration(tx, loc?.gstRegistrationId)
  const storeAddress = StoreAddressSchema.safeParse(s?.address ?? {})
  const timeZone = s?.timezone ?? 'Asia/Kolkata'

  const buyer: PoSheetParty = registration
    ? {
        name: registration.tradeName || registration.legalName,
        gstin: registration.gstin,
        address: addressLines({ ...registration.address, state: registration.stateCode }),
        email: registration.email || s?.email || null,
        phone: registration.phone || s?.phone || null,
      }
    : {
        name: s?.name ?? '',
        gstin: s?.gstin || null,
        address: storeAddress.success ? addressLines(storeAddress.data) : [],
        email: s?.email || null,
        phone: s?.phone || null,
      }
  const sheetLines = lines.map((l) => ({
    variantId: l.variantId,
    title: lineTitle(l.productTitle, l.variantTitle),
    sku: l.sku,
    hsnCode: l.hsnCode,
    quantity: l.quantity,
    unitPriceMinor: l.unitPriceMinor,
    totalMinor: l.quantity * l.unitPriceMinor,
  }))
  return {
    number: po.number,
    status: po.status,
    dateLabel: poDateLabel(po.orderedAt ?? po.createdAt, timeZone),
    expectedLabel: po.expectedAt ? poDateLabel(po.expectedAt, timeZone) : null,
    currency: po.currency,
    buyer,
    shipTo: {
      name: loc?.name ?? '',
      gstin: null,
      address: loc ? addressLines({ ...loc, state: loc.stateCode }) : [],
      email: null,
      phone: loc?.phone || null,
    },
    supplier: {
      name: po.supplierName,
      gstin: sup?.gstin || null,
      address: sup?.address ? sup.address.split(/\r?\n/).filter((l) => l.trim()) : [],
      email: po.supplierEmail || sup?.email || null,
      phone: po.supplierPhone || sup?.phone || null,
    },
    paymentTerms: sup?.paymentTerms || null,
    note: po.note || null,
    lines: sheetLines,
    units: sheetLines.reduce((n, l) => n + l.quantity, 0),
    totalMinor: sheetLines.reduce((n, l) => n + l.totalMinor, 0),
  }
}

export type PurchaseOrderEmailDeps = {
  /** The store's channels (`storeNotificationChannels`); only email ones are used. */
  channels: NotificationChannel[]
  /** `renderPurchaseOrderToBuffer` from `@commerce/invoices/render`. */
  renderPdf: (sheet: PurchaseOrderSheet) => Promise<Uint8Array>
}

export type PurchaseOrderEmailResult = { to: string; channel: string; markedOrdered: boolean }

/**
 * Email the purchase order PDF to the supplier. The first email channel that accepts it
 * sends it (one copy, never one per channel), and the send is logged in `notification`.
 * With `markOrdered` a draft becomes ordered first, so the PDF carries the order date; if
 * no channel accepts the email the whole step is refused and the draft stays a draft. The
 * address is saved onto the order when it had none.
 */
export async function emailPurchaseOrder(
  tx: StoreTx,
  storeId: string,
  raw: EmailPurchaseOrderInput,
  deps: PurchaseOrderEmailDeps,
): Promise<PurchaseOrderEmailResult> {
  const input = EmailPurchaseOrderSchema.parse(raw)
  const [po] = await tx
    .select({
      status: purchaseOrder.status,
      supplierEmail: purchaseOrder.supplierEmail,
    })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.id, input.id))
    .for('update')
  if (!po) throw new InventoryError('PO_NOT_FOUND', 'Purchase order not found', { storeId })
  if (po.status === 'cancelled') {
    throw new InventoryError('PO_CANCELLED', 'A cancelled purchase order cannot be sent', {
      storeId,
    })
  }
  const channels = deps.channels.filter((c) => c.requires === 'email')
  if (channels.length === 0) {
    throw new InventoryError(
      'NO_EMAIL_CHANNEL',
      'No email is set up for this store yet. Add a sender email in Settings → Notifications.',
      { storeId },
    )
  }
  const marking = input.markOrdered && po.status === 'draft'
  if (marking) await markOrdered(tx, storeId, input.id)
  if (!po.supplierEmail) {
    await tx
      .update(purchaseOrder)
      .set({ supplierEmail: input.to, updatedAt: new Date() })
      .where(eq(purchaseOrder.id, input.id))
  }

  const sheet = await loadPurchaseOrderSheet(tx, storeId, input.id)
  if (sheet.lines.length === 0) {
    throw new InventoryError('PO_EMPTY', 'Add at least one product first', { storeId })
  }
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  const money = (minor: number) => formatPurchaseAmount(minor, sheet.currency)
  const data: TemplateData = {
    storeName: s?.name ?? '',
    customerName: sheet.supplier.name,
    totalLabel: money(sheet.totalMinor),
    lines: sheet.lines.map((l) => ({
      title: l.title,
      quantity: l.quantity,
      priceLabel: money(l.totalMinor),
    })),
    paymentMethodLabel: '',
    purchaseOrder: {
      numberLabel: poNumberLabel(sheet.number),
      supplierName: sheet.supplier.name,
      expectedLabel: sheet.expectedLabel ?? undefined,
      message: input.message || undefined,
    },
  }
  const attachment = {
    filename: poFilename(sheet.number),
    contentType: 'application/pdf',
    content: await deps.renderPdf(sheet),
  }

  let lastError = ''
  for (const channel of channels) {
    const r = await channel.send({
      to: { email: input.to, name: sheet.supplier.name },
      template: 'purchase_order',
      data,
      attachments: [attachment],
    })
    await tx.insert(notification).values({
      storeId,
      channel: channel.id,
      template: 'purchase_order',
      to: input.to,
      status: r.ok ? 'sent' : 'failed',
      providerRef: r.ok ? r.providerRef : null,
      error: r.ok ? null : r.error,
    })
    if (r.ok) return { to: input.to, channel: channel.id, markedOrdered: marking }
    lastError = r.error
  }
  throw new InventoryError('EMAIL_FAILED', `The email did not go: ${lastError}`, { storeId })
}
