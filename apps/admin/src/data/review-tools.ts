/**
 * Copy for the Reviews app's tools beyond collecting: WhatsApp review requests, asking past
 * orders, QR cards, the photo review reward, AI summaries and product questions.
 */
export const reviewToolsContent = {
  channel: {
    label: 'Send requests by',
    options: { email: 'Email', whatsapp: 'WhatsApp', both: 'Email and WhatsApp' },
    whatsappHelp:
      'WhatsApp sends your approved templates named review_request and review_reminder, with the customer name, store name and review link as {{1}}, {{2}} and {{3}}. Orders without a phone number get nothing on WhatsApp.',
  },
  pastOrders: {
    title: 'Request reviews from past orders',
    body: 'Pick when the orders were delivered. Orders that already have a review, were asked before, or whose customer opted out are skipped.',
    from: 'Delivered from',
    to: 'Delivered to',
    counting: 'Counting orders...',
    none: 'No delivered orders in these dates still need asking.',
    preview: (orders: number, hours: number, perHour: number) =>
      `${orders} ${orders === 1 ? 'order' : 'orders'} will be asked, one request per order. ` +
      (hours > 1
        ? `They go out ${perHour} an hour, so the last ones leave in about ${hours} hours.`
        : 'They go out within the next hour.'),
    capped: (max: number) =>
      `More orders match than one run asks. This run asks the newest ${max}; run it again afterwards for the rest.`,
    send: (orders: number) => `Ask ${orders} ${orders === 1 ? 'order' : 'orders'}`,
    cancel: 'Cancel',
    done: (orders: number) =>
      orders === 0
        ? 'Nobody to ask: every order was already asked or opted out.'
        : `Review requests planned for ${orders} ${orders === 1 ? 'order' : 'orders'}.`,
  },
}
