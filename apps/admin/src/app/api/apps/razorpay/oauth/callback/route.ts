import { type NextRequest, NextResponse } from 'next/server'
import { adminUrl } from '@/lib/admin-origin'
import { appRouter, call, serverContext } from '@/lib/api'
import { withEvlog } from '@/lib/request-log'

/**
 * Razorpay sends the merchant back here after "Connect Razorpay" with a
 * one-time `code` and our signed `state`. The router checks the state belongs
 * to the signed-in store, swaps the code for tokens and saves them; the
 * merchant lands back on Settings → Payments either way.
 */
export const GET = withEvlog(async (req: NextRequest) => {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const back = adminUrl('/settings/payments')
  if (!code || !state) {
    back.searchParams.set('connect', 'cancelled')
    return NextResponse.redirect(back)
  }
  try {
    const context = await serverContext()
    const result = await call(
      appRouter.payments.razorpayOAuthComplete,
      { code, state },
      { context },
    )
    back.searchParams.set(
      'connect',
      result.webhook === 'registered' ? 'razorpay' : 'razorpay-webhook',
    )
  } catch {
    back.searchParams.set('connect', 'failed')
  }
  return NextResponse.redirect(back)
})
