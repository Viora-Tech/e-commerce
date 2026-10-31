import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Inventory' }

/** Stock has no page of its own; it opens on Inventory. */
export default function StockPage() {
  redirect(routes.stock.inventory())
}
