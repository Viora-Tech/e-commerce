'use client'

import ConversationsCard from './conversations-card'

type OrderCardProps = { orderId: string }

/** The Chatwoot app's card on the order page: the order's customer's conversations. */
export default function OrderCard({ orderId }: OrderCardProps) {
  // Render logic
  return <ConversationsCard kind="order" id={orderId} />
}
