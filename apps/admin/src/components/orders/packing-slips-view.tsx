'use client'

import { Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect } from 'react'
import { packingSlipsContent } from '@/data/orders-bulk'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { OrderDetail } from './order-detail-types'
import PackingSlip from './packing-slip'

type PackingSlipsViewProps = {
  orders: OrderDetail[]
  /** Some of the asked-for orders could not be found. */
  failed: boolean
}

/**
 * The print view behind the list's "Print packing slips": a short note on screen, and one
 * slip per printed page. The print dialog opens by itself once the page is drawn.
 */
export default function PackingSlipsView({ orders, failed }: PackingSlipsViewProps) {
  // Hooks
  const copy = useCopy(packingSlipsContent)

  useEffect(() => {
    if (orders.length > 0) window.print()
  }, [orders.length])

  // Render logic
  const message = orders.length === 0 ? copy.none : copy.ready(orders.length)

  return (
    <>
      <div className="flex flex-col items-start gap-4 p-6 print:hidden">
        <h1 className="text-page-title text-foreground">{copy.title}</h1>
        <p className="text-body text-muted-foreground">{message}</p>
        {failed ? <p className="text-body text-destructive">{copy.failed}</p> : null}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.orders.list()} />}
          >
            {copy.back}
          </Button>
          {orders.length > 0 ? (
            <Button onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              {copy.print}
            </Button>
          ) : null}
        </div>
      </div>
      {orders.map((o) => (
        <div key={o.id} className="break-after-page last:break-after-auto">
          <PackingSlip order={o} />
        </div>
      ))}
    </>
  )
}
