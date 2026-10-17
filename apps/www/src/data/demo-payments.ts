import type { BrandKey } from './logos'

/**
 * DEMO DATA for the payments tile: a made-up checkout stepping through each way to pay. The card
 * number is a standard test number, the amounts and order are invented.
 */
export type PaymentStep =
  | 'qr-apps'
  | 'card-typing'
  | 'otp'
  | 'banks'
  | 'redirect'
  | 'wallets'
  | 'cod-summary'
  | 'whatsapp'
  | 'paid'
  | 'confirmed'

export type PaymentMethod = {
  key: 'upi' | 'card' | 'netbanking' | 'wallets' | 'cod'
  label: string
  steps: readonly PaymentStep[]
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { key: 'upi', label: 'UPI', steps: ['qr-apps', 'paid'] },
  { key: 'card', label: 'Card', steps: ['card-typing', 'otp', 'paid'] },
  { key: 'netbanking', label: 'Net banking', steps: ['banks', 'redirect', 'paid'] },
  { key: 'wallets', label: 'Wallets', steps: ['wallets', 'paid'] },
  { key: 'cod', label: 'COD', steps: ['cod-summary', 'whatsapp', 'confirmed'] },
]

export const paymentDemoContent = {
  heading: 'How would you like to pay?',
  tablist: 'Payment method',
  amount: '₹2,999',
  stepMs: 850,
  /** A method stays on screen at least this long before the tile moves to the next one. */
  minDwellMs: 3000,
  qr: {
    title: 'Pay with any UPI app',
    body: 'Scan the code and approve the payment.',
    apps: ['googlepay', 'phonepe', 'paytm', 'bhim'] satisfies readonly BrandKey[],
  },
  card: {
    number: '4111 1111 1111 1111',
    label: 'Card number',
    networks: ['visa', 'mastercard', 'rupay'] satisfies readonly BrandKey[],
  },
  otp: { title: 'Enter the OTP sent to your phone', digits: ['4', '8', '2', '9', '1', '6'] },
  banks: {
    title: 'Choose your bank',
    options: ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak'],
    chosen: 'HDFC',
  },
  redirect: { title: 'Taking you to HDFC Bank…', body: 'Do not close this window.' },
  wallets: {
    title: 'Pick a wallet',
    options: [
      { name: 'Paytm', brand: 'paytm' as BrandKey | null },
      { name: 'PhonePe', brand: 'phonepe' as BrandKey | null },
      { name: 'Amazon Pay', brand: null },
      { name: 'MobiKwik', brand: null },
    ],
    chosen: 'PhonePe',
  },
  cod: {
    title: 'Cash on delivery',
    body: 'Pay ₹2,999 when your order arrives.',
    message: 'Please confirm your cash on delivery order #1043 for ₹2,999.',
    confirm: 'Confirm order',
    cancel: 'Cancel',
  },
  paid: { title: '₹2,999 paid', body: 'Confirmed automatically' },
  confirmed: { title: 'Order confirmed', body: 'Confirmed on WhatsApp' },
}
