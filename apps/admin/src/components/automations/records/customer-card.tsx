'use client'

import AutomationHistoryCard from './automation-history-card'

type CustomerCardProps = { customerId: string }

/** The Automations app's card on the customer page: "Automations on this customer". */
export default function CustomerCard({ customerId }: CustomerCardProps) {
  // Render logic
  return <AutomationHistoryCard type="customer" id={customerId} />
}
