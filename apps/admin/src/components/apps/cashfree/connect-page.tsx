import GatewayConnectPage from '@/components/payments/gateway-connect-page'

/** `/apps/cashfree/connect`: the guided Cashfree connect. */
export default function CashfreeConnectPage() {
  return <GatewayConnectPage providerId="cashfree" />
}
