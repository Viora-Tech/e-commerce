import type { api } from '@/lib/api-client'

/** Everything Settings → Payments loads in one call (`payments.setup`). */
export type PaymentsSetup = Awaited<ReturnType<typeof api.payments.setup>>
export type GatewayStatus = NonNullable<PaymentsSetup['primary']>
export type PaymentProblem = GatewayStatus['problems'][number]
export type CheckoutMethodRow = PaymentsSetup['methods'][number]

/** The gateways that can be connected today. */
export type GatewayId = 'razorpay' | 'cashfree'

export const isGatewayId = (id: string): id is GatewayId => id === 'razorpay' || id === 'cashfree'
export type GatewayApp = PaymentsSetup['gateways'][number]
