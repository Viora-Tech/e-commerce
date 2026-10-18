import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const brand = siteConfig.brand.name

export const refundsDoc: LegalDoc = {
  slug: 'refunds',
  title: 'Refund & cancellation policy',
  description: `How cancelling a ${brand} plan and refunds work.`,
  lead: `How cancelling a ${brand} plan and refunds work.`,
  readMinutes: 4,
  sections: sections([
    {
      title: 'Subscriptions',
      plain: ['Plans renew on their own.', 'Until you cancel.'],
      body: [
        `${brand} plans renew automatically every month or year, matching the billing you chose, until you cancel.`,
      ],
    },
    {
      title: 'Cancelling',
      plain: ['Cancel in two clicks.', 'You keep access till the period ends.'],
      body: [
        'Cancel any time from Settings → Plan. Your plan stays active until the end of the period you paid for.',
      ],
    },
    {
      title: 'Refunds',
      plain: ['Refund window to be set.', 'No refunds for half-used periods.'],
      body: [
        '[Refund eligibility — e.g. within N days of first payment]. Partial periods are not refunded unless the law requires.',
      ],
    },
    {
      title: 'Failed or duplicate payments',
      plain: ['Double charge? Full refund.', 'Failed payment that took money? Full refund.'],
      body: [
        'If you were charged twice or a payment failed after money left your account, we refund it in full.',
      ],
      callout: {
        title: 'Duplicate charges are always refunded in full.',
        text: 'No questions asked.',
      },
    },
    {
      title: 'How to ask for a refund',
      plain: ['Email us with your payment reference.', 'We confirm within [N] days.'],
      body: [
        `Write to ${siteConfig.contact.supportEmail} with your store name and payment reference.`,
      ],
    },
    {
      title: 'Processing time',
      plain: ['Money goes back where it came from.', 'Within [N] business days.'],
      body: ['Approved refunds go back to the original payment method within [N] business days.'],
    },
  ]),
}
