/** Copy for the Customers section. */
export const customersContent = {
  index: {
    heading: 'No customers yet',
    body: 'Everyone who places an order or creates an account shows up here with their order history and contact details.',
    action: { label: 'View orders', href: '/orders' },
  },
  segments: {
    heading: 'No segments',
    body: 'Segments are saved customer filters, such as repeat buyers, big spenders or one city, for targeted discounts and messages.',
    action: { label: 'View customers', href: '/customers' },
  },
  detail: {
    heading: 'Customer not found',
    body: 'This customer record does not exist in the current store.',
    action: { label: 'Back to customers', href: '/customers' },
  },
} as const
