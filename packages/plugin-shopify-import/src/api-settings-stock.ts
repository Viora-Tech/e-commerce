/** Purchase orders and transfers from the Admin API for the store settings import (audit #75), mapped for settings-plan-stock.ts. */

import { PAGE_INFO, type Page } from './api-settings-read'
import type { NPurchaseOrder, NStockLine, NStockLocation, NTransfer } from './settings-plan-stock'
import type { ShopifyClient } from './shopify-client'

/* ------------------------------------------------ purchase orders, transfers */

/*
 * Purchase orders and transfers, Admin API 2026-10 (verified against shopify.dev on 2026-10-31
 * and validated against the 2026-10 schema):
 *  - https://shopify.dev/docs/api/admin-graphql/2026-10/queries/inventoryPurchaseOrders
 *    needs `read_inventory_purchase_orders` (read_inventory no longer covers purchase orders:
 *    https://shopify.dev/changelog/purchase-order-read-api). Statuses DRAFT and ORDERED, plus
 *    `archivedAt`. Lines give `totalQuantity` and `unitCost` but no received count; receipts
 *    are the linked `transfers`.
 *  - https://shopify.dev/docs/api/admin-graphql/2026-10/queries/inventoryTransfers needs
 *    `read_inventory_transfers`. Statuses DRAFT, READY_TO_SHIP, IN_PROGRESS, TRANSFERRED,
 *    CANCELED, OTHER. Origin and destination are `LocationSnapshot`s whose `location` is null
 *    once the location is deleted.
 *  - Lines name an `inventoryItem`, whose `variant` gives the product to match through the
 *    products import.
 */
const STOCK_LINE_VARIANT = 'inventoryItem { variant { sku title product { id } } }'
const PO_LINE_FIELDS = `totalQuantity title unitCost { amount } ${STOCK_LINE_VARIANT}`
const TRANSFER_LINE_FIELDS = `totalQuantity title ${STOCK_LINE_VARIANT}`

const PURCHASE_ORDERS_QUERY = `query PurchaseOrders($cursor: String) {
  inventoryPurchaseOrders(first: 25, after: $cursor) {
    ${PAGE_INFO}
    nodes {
      id name status currency orderedAt archivedAt
      origin { supplierName }
      destination { name location { id } }
      transfers(first: 10) { nodes { receivedQuantity } }
      lineItems(first: 100) { ${PAGE_INFO} nodes { ${PO_LINE_FIELDS} } }
    }
  }
}`

const PURCHASE_ORDER_LINES_QUERY = `query PurchaseOrderLines($id: ID!, $cursor: String) {
  inventoryPurchaseOrder(id: $id) {
    lineItems(first: 100, after: $cursor) { ${PAGE_INFO} nodes { ${PO_LINE_FIELDS} } }
  }
}`

const TRANSFERS_QUERY = `query Transfers($cursor: String) {
  inventoryTransfers(first: 25, after: $cursor) {
    ${PAGE_INFO}
    nodes {
      id name status note dateCreated
      origin { name location { id } }
      destination { name location { id } }
      lineItems(first: 100) { ${PAGE_INFO} nodes { ${TRANSFER_LINE_FIELDS} } }
    }
  }
}`

const TRANSFER_LINES_QUERY = `query TransferLines($id: ID!, $cursor: String) {
  inventoryTransfer(id: $id) {
    lineItems(first: 100, after: $cursor) { ${PAGE_INFO} nodes { ${TRANSFER_LINE_FIELDS} } }
  }
}`

type GStockLine = {
  totalQuantity: number
  title: string | null
  unitCost?: { amount: string } | null
  inventoryItem: {
    variant: { sku: string | null; title: string | null; product: { id: string } | null } | null
  } | null
}
type GLocationSnapshot = { name: string; location: { id: string } | null } | null

type GPurchaseOrder = {
  id: string
  name: string
  status: string
  currency: string
  orderedAt: string | null
  archivedAt: string | null
  origin: { supplierName: string | null } | null
  destination: GLocationSnapshot
  transfers: { nodes: { receivedQuantity: number }[] } | null
  lineItems: Page<GStockLine>
}

type GTransfer = {
  id: string
  name: string
  status: string
  note: string | null
  dateCreated: string | null
  origin: GLocationSnapshot
  destination: GLocationSnapshot
  lineItems: Page<GStockLine>
}

const stockLocation = (l: GLocationSnapshot): NStockLocation | null =>
  l ? { sourceId: l.location?.id ?? null, name: l.name } : null

function stockLine(l: GStockLine): NStockLine {
  const v = l.inventoryItem?.variant ?? null
  return {
    productSourceId: v?.product?.id ?? null,
    sku: v?.sku ?? null,
    variantTitle: v?.title ?? null,
    title: l.title ?? '',
    quantity: l.totalQuantity,
    unitCost: l.unitCost?.amount ?? null,
  }
}

/** Every line of one record: the first page came with it, the rest are read by its id. */
async function allLines(
  client: ShopifyClient,
  first: Page<GStockLine>,
  query: string,
  pick: (data: unknown) => Page<GStockLine> | undefined,
  id: string,
): Promise<GStockLine[]> {
  const out = [...first.nodes]
  let page = first.pageInfo
  // Our documents hold up to 500 lines; past that the save refuses it anyway.
  while (page.hasNextPage && page.endCursor && out.length < 600) {
    const next = pick(await client.query<unknown>(query, { id, cursor: page.endCursor }, 100))
    if (!next) break
    out.push(...next.nodes)
    page = next.pageInfo
  }
  return out
}

export async function fetchPurchaseOrders(client: ShopifyClient): Promise<NPurchaseOrder[]> {
  const out: NPurchaseOrder[] = []
  for await (const nodes of client.paginate<GPurchaseOrder>(
    PURCHASE_ORDERS_QUERY,
    (d) => (d as { inventoryPurchaseOrders: Page<GPurchaseOrder> }).inventoryPurchaseOrders,
    {},
    300,
  )) {
    for (const po of nodes) {
      const lines = await allLines(
        client,
        po.lineItems,
        PURCHASE_ORDER_LINES_QUERY,
        (d) =>
          (d as { inventoryPurchaseOrder: { lineItems: Page<GStockLine> } | null })
            .inventoryPurchaseOrder?.lineItems,
        po.id,
      )
      out.push({
        sourceId: po.id,
        name: po.name,
        status: po.status,
        archived: po.archivedAt !== null,
        currency: po.currency,
        supplierName: po.origin?.supplierName ?? null,
        destination: stockLocation(po.destination),
        orderedAt: po.orderedAt,
        received: (po.transfers?.nodes ?? []).some((t) => t.receivedQuantity > 0),
        lines: lines.map(stockLine),
      })
    }
  }
  return out
}

export async function fetchTransfers(client: ShopifyClient): Promise<NTransfer[]> {
  const out: NTransfer[] = []
  for await (const nodes of client.paginate<GTransfer>(
    TRANSFERS_QUERY,
    (d) => (d as { inventoryTransfers: Page<GTransfer> }).inventoryTransfers,
    {},
    300,
  )) {
    for (const t of nodes) {
      const lines = await allLines(
        client,
        t.lineItems,
        TRANSFER_LINES_QUERY,
        (d) =>
          (d as { inventoryTransfer: { lineItems: Page<GStockLine> } | null }).inventoryTransfer
            ?.lineItems,
        t.id,
      )
      out.push({
        sourceId: t.id,
        name: t.name,
        status: t.status,
        note: t.note,
        createdAt: t.dateCreated,
        origin: stockLocation(t.origin),
        destination: stockLocation(t.destination),
        lines: lines.map(stockLine),
      })
    }
  }
  return out
}
