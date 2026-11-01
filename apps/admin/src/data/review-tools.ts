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
  qr: {
    title: 'Review QR card',
    subtitle: (order: number | null) =>
      order === null
        ? 'Print it or put it on your packaging. Scanning it opens the review form for this product.'
        : `For order #${order}. Pack it in the parcel: each code opens the review form for one product, and the review gets the verified buyer badge.`,
    back: 'Reviews',
    open: 'Review QR card',
    heading: 'Loved it? Leave a review',
    scan: 'Scan with your phone camera',
    png: 'Download card',
    svg: 'Download QR (SVG)',
    copyLink: 'Copy link',
    copied: 'Link copied',
    alt: (title: string) => `QR code to review ${title}`,
    expires: 'Order links stay valid for 60 days.',
    empty: 'Nothing to make a card for: the product or order is gone, or has no products.',
    failed: 'The QR code could not be made. Please try again.',
  },
  reward: {
    title: 'Reward photo reviews',
    help: 'Thank customers who add photos: when their review is published, they get a one-time discount code by email.',
    enabled: 'Send a discount code for photo reviews',
    percent: 'Discount',
    days: 'Code works for',
    daysUnit: 'days',
    note: 'One code per review, for that customer only, used once. Only reviews written on your store count, not imported ones. The email is "Photo review thanks" in Settings, Notifications.',
  },
  summary: {
    title: 'What customers say (AI)',
    enabled: "Write an AI summary of each product's reviews",
    help: 'Two or three sentences on what customers like and any common complaint, on the product page.',
    note: 'Needs three published reviews. It is written again within about 15 minutes of new reviews and uses your AI allowance (product writer, Settings, AI). Add the "What customers say (AI)" section to your product template in Customize.',
    refresh: 'Refresh',
    pending: 'Refreshing soon',
    queued: 'The summary will be written again within about 15 minutes.',
    none: 'No summary yet. It is written once the product has three published reviews.',
    written: (date: string, reviews: number) =>
      `Written ${date} from ${reviews} ${reviews === 1 ? 'review' : 'reviews'}`,
    failed: 'That did not work. Please try again.',
  },
  questions: {
    title: 'Questions',
    subtitle:
      'What shoppers ask on your product pages. Answer and publish to show it on the product.',
    back: 'Reviews',
    open: 'Questions',
    tabs: { unanswered: 'To answer', pending: 'Waiting', published: 'Published', hidden: 'Hidden' },
    search: 'Search questions or products',
    asked: (name: string, date: string) => `${name || 'A shopper'} asked on ${date} about`,
    answer: 'Your answer',
    answerPlaceholder:
      'Answer in a sentence or two. It shows under the question on the product page.',
    save: 'Save',
    publish: 'Publish answer',
    republish: 'Published',
    hide: 'Hide',
    delete: 'Delete',
    deleteTitle: 'Delete this question?',
    deleteBody: 'It is gone for good, with its answer.',
    saved: 'Answer saved',
    published: 'Answer published on the product page',
    hidden: 'Question hidden',
    deleted: 'Question deleted',
    empty: {
      heading: 'No questions here',
      body: 'Questions arrive when shoppers ask on a product page. Add the "Questions and answers" section to your product template in Customize.',
    },
    previous: 'Previous',
    next: 'Next',
    pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
    failed: 'That did not work. Please try again.',
  },
}
