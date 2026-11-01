import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

/** `/apps/cashfree`: one place to manage Cashfree, its provider page under Settings › Payments. */
export default function CashfreeOverviewPage() {
  return redirect(routes.settings.paymentProvider('cashfree'))
}
