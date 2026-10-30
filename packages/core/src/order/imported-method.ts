/**
 * An imported order's payment method from the old platform's gateway names, in our keys where
 * one matches (Shopify: "Cards, UPI, NB, Wallets by Razorpay", "Cash on Delivery (COD)", "UPI Id").
 * Imports leave `order.payment_method` empty on purpose (it drives checkout behaviour), so
 * Analytics read "Unknown" for 100 of Waimers' orders (audit #96).
 */
export function importedMethod(gateways: string | null): string | null {
  const first = gateways?.split(',')[0]?.trim()
  if (!first) return null
  const g = gateways?.toLowerCase() ?? ''
  if (g.includes('razorpay')) return 'razorpay'
  if (g.includes('cashfree')) return 'cashfree'
  if (g.includes('decentro')) return 'decentro'
  if (/cash on delivery|\bcod\b/.test(g)) return 'cod'
  if (g.includes('gift_card') || g.includes('gift card')) return 'gift_card'
  if (/\bupi\b|bank deposit|manual/.test(g)) return 'manual'
  return first
}
