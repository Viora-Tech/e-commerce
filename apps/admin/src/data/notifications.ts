/** Copy for Settings → Notifications. */
export const notificationsSettingsContent = {
  title: 'Notifications',
  intro:
    'Shoppers get a message when their order is placed, when payment is confirmed, and when it ships. Every enabled channel receives every event.',
  events: [
    { id: 'order_placed', label: 'Order placed', when: 'right after checkout' },
    { id: 'payment_received', label: 'Payment received', when: 'gateway capture or marked paid' },
    { id: 'order_shipped', label: 'Order shipped', when: 'order marked fulfilled' },
  ],
  hints: {
    ses: 'Verify the from address (or its domain) in the SES console. Sandbox accounts can only mail verified recipients until AWS grants production access.',
    whatsapp:
      'Create three templates in Meta Business Manager named order_placed, payment_received and order_shipped with body placeholders {{1}}…{{4}} in that order. Tick test mode to use plain text before they are approved.',
    log: 'Prints each message to the worker console. For development only.',
  } as Record<string, string>,
} as const
