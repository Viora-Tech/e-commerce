import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

/** `/apps/razorpay`: one place to manage Razorpay, its provider page under Settings › Payments. */
export default function RazorpayOverviewPage() {
  return redirect(routes.settings.paymentProvider('razorpay'))
}
