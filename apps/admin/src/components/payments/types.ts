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

/** Gateways with Live/Test key sets and an Active/Inactive state. */
const MODE_GATEWAYS = ['razorpay', 'cashfree', 'decentro'] as const
export type ModeGatewayId = (typeof MODE_GATEWAYS)[number]

export const isModeGateway = (id: string): id is ModeGatewayId =>
  (MODE_GATEWAYS as readonly string[]).includes(id)
