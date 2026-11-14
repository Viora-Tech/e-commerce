'use client'

import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusLabel from '@/components/status/status-label'
import { supplierFormContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type SupplierOrdersCardProps = {
  orders: Awaited<ReturnType<typeof api.suppliers.get>>['orders']
}

/** The latest purchase orders placed with this supplier. */
export default function SupplierOrdersCard({ orders }: SupplierOrdersCardProps) {
  // Hooks
  const { orders: copy } = useCopy(supplierFormContent)

  // Render logic
  return (
    <DataCard title={copy.heading}>
      {orders.length === 0 ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3">
              <Link
                href={routes.stock.purchaseOrder(o.id)}
                className="text-body-strong hover:underline"
              >
                {copy.number(o.number)}
              </Link>
              <StatusLabel kind="purchaseOrder" value={o.status} />
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
