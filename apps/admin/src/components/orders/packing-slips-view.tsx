'use client'

import type { DocStore } from '@commerce/core'
import {
  type DocumentKind,
  packingSlipData,
  pickListData,
  printDocument,
  renderTemplate,
} from '@commerce/core/document-templates'
import { Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRef } from 'react'
import DocumentFrame from '@/components/documents/document-frame'
import { documentTemplatesContent } from '@/data/document-templates'
import { packingSlipsContent } from '@/data/orders-bulk'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { OrderDetail } from './order-detail-types'

type PackingSlipsViewProps = {
  /** Which template prints: packing slips, one pick list, or invoices. */
  kind: DocumentKind
  orders: OrderDetail[]
  /** The store's template for `kind` (its own, else the default). */
  html: string
  store: DocStore
  /** The GST invoices app makes tax invoices; the Invoice template is not printed then. */
  gstApp: boolean
  /** Some of the asked-for orders could not be found. */
  failed: boolean
}

/** Every filled template, one page each (the pick list is one document for all orders). */
function bodiesFor(kind: DocumentKind, html: string, orders: OrderDetail[], store: DocStore) {
  if (orders.length === 0) return []
  if (kind === 'pick_list') return [renderTemplate(html, pickListData(orders, store))]
  return orders.map((o) => renderTemplate(html, packingSlipData(o, store)))
}

/**
 * The print view behind the orders' "Print packing slips", "Print pick list" and "Print
 * invoices" (audit #164): the store's template filled from each order, drawn in a sandboxed
 * frame. The print dialog opens by itself once the frame has loaded.
 */
export default function PackingSlipsView({
  kind,
  orders,
  html,
  store,
  gstApp,
  failed,
}: PackingSlipsViewProps) {
  // Hooks
  const copy = useCopy(packingSlipsContent)
  const docs = useCopy(documentTemplatesContent)
  const frame = useRef<HTMLIFrameElement>(null)
  const printed = useRef(false)

  // Event handlers
  const handlePrint = () => frame.current?.contentWindow?.print()

  const handleLoaded = () => {
    if (printed.current) return
    printed.current = true
    handlePrint()
  }

  // Render logic
  const blocked = kind === 'invoice' && gstApp
  const bodies = blocked ? [] : bodiesFor(kind, html, orders, store)
  const title = docs.print.titles[kind]
  const message =
    orders.length === 0
      ? copy.none
      : kind === 'packing_slip'
        ? copy.ready(orders.length)
        : copy.readyOrders(orders.length)

  return (
    <div className="flex h-dvh flex-col gap-4 p-6">
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-page-title text-foreground">{title}</h1>
        <p className="text-body text-muted-foreground">{blocked ? docs.print.gstApp : message}</p>
        {failed ? <p className="text-body text-destructive">{copy.failed}</p> : null}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.orders.list()} />}
          >
            {copy.back}
          </Button>
          {bodies.length > 0 ? (
            <Button onClick={handlePrint}>
              <Printer aria-hidden="true" />
              {copy.print}
            </Button>
          ) : null}
        </div>
      </div>
      {bodies.length > 0 ? (
        <DocumentFrame
          ref={frame}
          html={printDocument(bodies, title)}
          title={docs.print.frame}
          onLoad={handleLoaded}
          className="min-h-0 w-full flex-1 rounded-lg border border-border"
        />
      ) : null}
    </div>
  )
}
