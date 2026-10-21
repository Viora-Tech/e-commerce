/**
 * Copy for the websites a store must register in Razorpay: the list on the Razorpay
 * connect form, the warning on Settings → Payments after Razorpay blocked a payment, and
 * the failure reason on an order's payment attempt.
 */
export const razorpayWebsitesContent = {
  /** The list on Settings → Payments and under the webhook fields on the Razorpay connect form. */
  list: {
    label: 'Websites to register in Razorpay',
    help: 'In the Razorpay Dashboard, open Account & Settings → Website and app details and add each of these. Razorpay blocks live payments from a website that is not listed there.',
    empty:
      'Your store has no live web address yet. Once it has one, it shows here to add in Razorpay.',
  },
  /** The warning on Settings → Payments. */
  banner: {
    title: 'Razorpay is blocking payments from your website',
    body: (sites: string) =>
      `Razorpay refused a payment because the website it came from is not on your Razorpay account. In the Razorpay Dashboard, open Account & Settings → Website and app details, add ${sites}, then try a payment again.`,
    yourWebsite: 'your store’s web address',
    when: (when: string) => `Last blocked payment: ${when}.`,
    action: 'See the websites to add',
  },
  /** The line under a failed attempt on the order page. */
  attempt: {
    failedReason: 'Why it failed',
    websiteFix:
      'Add your store’s website in Razorpay (Account & Settings → Website and app details).',
  },
}
