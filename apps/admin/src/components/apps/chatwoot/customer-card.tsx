'use client'

import ConversationsCard from './conversations-card'

type CustomerCardProps = { customerId: string }

/** The Chatwoot app's card on the customer page: that customer's conversations. */
export default function CustomerCard({ customerId }: CustomerCardProps) {
  // Render logic
  return <ConversationsCard kind="customer" id={customerId} />
}
