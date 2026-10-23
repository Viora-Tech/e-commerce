'use client'

import AutomationHistoryCard from './automation-history-card'

type OrderCardProps = { orderId: string }

/** The Automations app's card on the order page: "Automations on this order". */
export default function OrderCard({ orderId }: OrderCardProps) {
  // Render logic
  return <AutomationHistoryCard type="order" id={orderId} />
}
