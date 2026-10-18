/**
 * Brand marks for the services the platform works with. Files live in `public/logos` and their
 * sources are listed in `public/logos/SOURCES.md`. A brand without a file renders as a text mark.
 */
export type BrandKey =
  | 'razorpay'
  | 'cashfree'
  | 'decentro'
  | 'upi'
  | 'delhivery'
  | 'shiprocket'
  | 'rapidshyp'
  | 'whatsapp'
  | 'shopify'
  | 'phonepe'
  | 'paytm'
  | 'googlepay'
  | 'visa'
  | 'mastercard'
  | 'rupay'
  | 'bhim'

export type Brand = {
  name: string
  /** Absent when no official file could be found: a text mark is shown. */
  file?: string
  /** Width over height of the artwork, so the box keeps its shape before the file loads. */
  ratio: number
  /** Rendered height: marks are optically matched, wordmarks sit a little lower. */
  height: 'h-6' | 'h-5' | 'h-4'
}

export const BRANDS: Record<BrandKey, Brand> = {
  razorpay: { name: 'Razorpay', file: '/logos/razorpay.svg', ratio: 1, height: 'h-6' },
  cashfree: { name: 'Cashfree', file: '/logos/cashfree.svg', ratio: 122 / 32, height: 'h-5' },
  decentro: { name: 'Decentro', file: '/logos/decentro.svg', ratio: 2749.7 / 728, height: 'h-5' },
  upi: { name: 'UPI', ratio: 2, height: 'h-5' },
  delhivery: { name: 'Delhivery', ratio: 4, height: 'h-5' },
  shiprocket: {
    name: 'Shiprocket',
    file: '/logos/shiprocket.svg',
    ratio: 854.34 / 189.9,
    height: 'h-5',
  },
  rapidshyp: { name: 'RapidShyp', file: '/logos/rapidshyp.svg', ratio: 182 / 38, height: 'h-4' },
  whatsapp: { name: 'WhatsApp', file: '/logos/whatsapp.svg', ratio: 1, height: 'h-6' },
  shopify: { name: 'Shopify', file: '/logos/shopify.svg', ratio: 1, height: 'h-6' },
  phonepe: { name: 'PhonePe', file: '/logos/phonepe.svg', ratio: 1, height: 'h-6' },
  paytm: { name: 'Paytm', file: '/logos/paytm.svg', ratio: 1, height: 'h-6' },
  googlepay: { name: 'Google Pay', file: '/logos/googlepay.svg', ratio: 1, height: 'h-6' },
  visa: { name: 'Visa', file: '/logos/visa.svg', ratio: 2.4, height: 'h-4' },
  mastercard: { name: 'Mastercard', file: '/logos/mastercard.svg', ratio: 1, height: 'h-6' },
  rupay: { name: 'RuPay', ratio: 2, height: 'h-5' },
  bhim: { name: 'BHIM', ratio: 2, height: 'h-5' },
}
