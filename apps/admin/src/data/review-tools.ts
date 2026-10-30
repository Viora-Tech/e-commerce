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
}
