import { redeemStaffSignIn } from '@commerce/core'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { writeCustomerToken, writeStaffMarker } from '@/lib/customer-session'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

/**
 * Where the admin's "Sign in as customer" lands, in a new tab: spend the single-use ticket
 * under this store's RLS and start a one-hour session (a browser-session cookie) that records
 * the staff member. Anything wrong lands on the sign-in page, signed in as nobody new.
 */
export const GET = withEvlog(async (request: NextRequest, { params }: Params) => {
  const { storeId } = await params
  if ((await headers()).get('x-store-id') !== storeId) {
    return new NextResponse('Not found', { status: 404 })
  }
  const result = await inStore(storeId, (tx) =>
    redeemStaffSignIn({ tx, storeId }, request.nextUrl.searchParams.get('token')),
  )
  if (!result.ok)
    redirect(`/account/login?error=${result.reason === 'expired' ? 'expired' : 'failed'}`)
  await writeCustomerToken(result.token, result.expiresAt, false)
  await writeStaffMarker(result.expiresAt)
  redirect('/account')
})
