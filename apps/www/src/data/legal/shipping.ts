import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const brand = siteConfig.brand.name
const domain = siteConfig.brand.domain

export const shippingDoc: LegalDoc = {
  slug: 'shipping',
  title: 'Shipping & delivery policy',
  description: `${brand} is a digital service. No physical goods are shipped.`,
  lead: `${brand} is a digital service. No physical goods are shipped.`,
  readMinutes: 3,
  sections: sections([
    {
      title: 'Digital service',
      plain: [`${brand} is software, used online.`, 'Nothing is posted to you.'],
      body: [
        `${brand} is software you use online at ${domain}. We do not ship any physical product to you.`,
      ],
      callout: {
        title: 'No physical delivery.',
        text: `Payment gateways require this page; it confirms ${brand} is a digital service.`,
      },
    },
    {
      title: 'Access after payment',
      plain: ['Access starts when payment clears.', 'You get an email.'],
      body: [
        'Your plan is active [Immediately] after your payment is confirmed. You get a confirmation by email.',
      ],
    },
    {
      title: 'Invoices',
      plain: ['GST invoice by email.', 'Also in Settings.'],
      body: [
        'GST invoices are emailed to the billing address on your account and are available in Settings.',
      ],
    },
    {
      title: 'Your own store’s shipping',
      plain: ['Your store has its own shipping policy.', 'You write it for your customers.'],
      body: [
        'Merchants set their own shipping and delivery policies for their customers on their stores.',
      ],
    },
  ]),
}
