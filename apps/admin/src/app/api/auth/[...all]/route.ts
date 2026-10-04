import { loadEnv } from '@commerce/config'
import {
  checkRateLimit,
  clientIp,
  createRedisRateLimitStore,
  rateLimitKey,
  retryAfterSeconds,
} from '@commerce/core'
import { sharedRedis } from '@commerce/queue'
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'

/**
 * Built on the first request, not at import: `next build` imports every route to read its config,
 * and the image is built without DATABASE_URL / REDIS_URL / AUTH_SECRET.
 */
let handlers: ReturnType<typeof toNextJsHandler> | undefined
const authHandlers = () => (handlers ??= toNextJsHandler(auth()))
const authPost = (request: Request) => authHandlers().POST(request)

export function GET(request: Request): Promise<Response> {
  return authHandlers().GET(request)
}

/** Better Auth's email-OTP plugin route; per email and per IP, generous but not open. */
const OTP_SEND_PATH = '/email-otp/send-verification-otp'
const OTP_SEND_IP_RULE = { limit: 10, windowMs: 10 * 60 * 1000 }
const OTP_SEND_EMAIL_RULE = { limit: 5, windowMs: 10 * 60 * 1000 }

const g = globalThis as unknown as {
  __rateLimitStore?: ReturnType<typeof createRedisRateLimitStore>
}
function rateLimitStore() {
  if (!g.__rateLimitStore) {
    g.__rateLimitStore = createRedisRateLimitStore(sharedRedis(loadEnv(process.env).REDIS_URL))
  }
  return g.__rateLimitStore
}

function tooManyRequests(retryAfter: number) {
  return Response.json(
    { error: 'Too many attempts. Please wait and try again.' },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  )
}

/**
 * Wraps Better Auth's catch-all so the OTP send endpoint is rate limited
 * before it can queue an email, without touching the plugin itself. Every
 * other admin auth route (session, organization, sign-out, ...) passes
 * straight through.
 */
export async function POST(request: Request): Promise<Response> {
  if (!new URL(request.url).pathname.endsWith(OTP_SEND_PATH)) return authPost(request)

  const ip = clientIp(request.headers)
  const byIp = await checkRateLimit(
    rateLimitStore(),
    rateLimitKey('admin-otp-send:ip', ip),
    OTP_SEND_IP_RULE,
  )
  if (!byIp.ok) return tooManyRequests(retryAfterSeconds(byIp))

  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null
  if (email) {
    const byEmail = await checkRateLimit(
      rateLimitStore(),
      rateLimitKey('admin-otp-send:email', email),
      OTP_SEND_EMAIL_RULE,
    )
    if (!byEmail.ok) return tooManyRequests(retryAfterSeconds(byEmail))
  }
  return authPost(request)
}
