import { devOtpEnabled, devOtpHostAllowed, recallDevOtp } from '@/lib/dev-otp'

/**
 * The login code the server last printed for an email (development only).
 *
 * Exists so a developer is not reading the `verification` table out of Postgres to
 * sign in. Answers 404 everywhere it is not explicitly enabled, and never caches:
 * what it returns is a single-use code with minutes left on it. Beyond the env
 * flags, also refuses any request that did not arrive on localhost (or an
 * explicitly allowed host, `DEV_OTP_ALLOWED_HOSTS`) — see `devOtpHostAllowed`.
 */
export async function GET(request: Request) {
  if (!devOtpEnabled() || !devOtpHostAllowed(request.headers.get('host'))) {
    return new Response(null, { status: 404 })
  }
  const email = new URL(request.url).searchParams.get('email') ?? ''
  const otp = recallDevOtp(email)
  if (!otp) return new Response(null, { status: 404 })
  return Response.json({ otp }, { headers: { 'cache-control': 'no-store' } })
}
