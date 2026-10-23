import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const brand = siteConfig.brand.name

export const acceptableUseDoc: LegalDoc = {
  slug: 'acceptable-use',
  title: 'Acceptable use policy',
  description: `What you can and cannot sell or do on ${brand}.`,
  lead: `What you can and cannot sell or do on ${brand}.`,
  readMinutes: 4,
  sections: sections([
    {
      title: 'Why this exists',
      plain: [
        'Keeps everyone safe.',
        `To keep ${brand} safe for merchants, shoppers and our partners.`,
      ],
    },
    {
      title: 'Prohibited goods and services',
      plain: ['No illegal or fake goods.', 'Nothing payment partners ban.'],
      body: [
        'Anything illegal in India or where you sell; counterfeit, pirated or stolen goods and anything that infringes someone else’s trademark or copyright; weapons, ammunition and explosives; narcotics, regulated drugs and prescription medicines sold without the required licence; tobacco, alcohol and other age-restricted goods sold without the required licence or age checks; sexually explicit content or services; gambling, lotteries and betting; and any product or service our payment partners do not allow.',
      ],
    },
    {
      title: 'Prohibited conduct',
      plain: ['No fraud or spam.', 'No attacking the platform.'],
      body: [
        'Fraud, phishing, spam, scraping other stores, attacking the platform, or impersonating others.',
      ],
    },
    {
      title: 'Messaging rules',
      plain: ['Message only people who said yes.', 'Use approved WhatsApp templates.'],
      body: [
        'Send WhatsApp, SMS and email only to customers who agreed to hear from you, using approved templates.',
      ],
    },
    {
      title: 'What we may do',
      plain: ['We may limit or suspend a store.', 'With notice where we can.'],
      body: [
        'Remove content, limit features or suspend stores that break this policy, with notice where possible.',
      ],
      callout: {
        title: 'Breaking this policy can suspend your store.',
        text: 'We tell you first wherever the law and safety allow.',
      },
    },
  ]),
}
