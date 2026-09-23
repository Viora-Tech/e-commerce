import { devOtpEnabled, recallDevOtp } from '@/lib/dev-otp'

/**
 * The sign-in code the storefront last issued for an email on this store
 * (development only). The store comes from the proxy's `x-store-id`, never the
 * client. 404 everywhere it is not explicitly enabled; never cached.
 */
export async function GET(request: Request) {
  if (!devOtpEnabled()) return new Response(null, { status: 404 })
  const storeId = request.headers.get('x-store-id') ?? ''
  const email = new URL(request.url).searchParams.get('email') ?? ''
  const otp = storeId ? recallDevOtp(storeId, email) : null
  if (!otp) return new Response(null, { status: 404 })
  return Response.json({ otp }, { headers: { 'cache-control': 'no-store' } })
}
