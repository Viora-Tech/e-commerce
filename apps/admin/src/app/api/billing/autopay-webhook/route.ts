import { loadEnv } from '@commerce/config'
import { autopayConfig, handleAutopayWebhook, resolveBillingEnv } from '@commerce/core'
import { db } from '@/lib/db'

/**
 * Razorpay → UPI AutoPay (Settings → Plan & billing): subscription events from the platform's
 * own Razorpay account. A charge becomes a paid plan bill; other events move the mandate.
 * Signed with PLATFORM_RAZORPAY_WEBHOOK_SECRET; anything unsigned is refused.
 */
export async function POST(request: Request) {
  const cfg = autopayConfig(process.env)
  if (!cfg) return new Response('AutoPay is off', { status: 404 })
  const raw = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''
  const env = loadEnv(process.env)
  const billing = await resolveBillingEnv(db(), {
    salesStoreId: env.PLATFORM_SALES_STORE_ID,
    settingsSecret: env.SETTINGS_SECRET,
    storefrontUrl: env.STOREFRONT_URL,
  })
  const result = await handleAutopayWebhook(db(), raw, signature, cfg, billing)
  if (result === 'bad_signature') return new Response('Bad signature', { status: 401 })
  return Response.json({ ok: true, result })
}
