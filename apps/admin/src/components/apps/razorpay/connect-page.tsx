import GatewayConnectPage from '@/components/payments/gateway-connect-page'

/** `/apps/razorpay/connect`: the guided Razorpay connect. */
export default function RazorpayConnectPage() {
  return <GatewayConnectPage providerId="razorpay" />
}
