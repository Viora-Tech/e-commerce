import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

/** Stock has no page of its own; it opens on Inventory. */
export default function StockPage() {
  redirect(routes.stock.inventory())
}
