import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const brand = siteConfig.brand.name
const domain = siteConfig.brand.domain

export const privacyDoc: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy policy',
  description: `How [Company legal name] collects, uses and protects personal data under India’s Digital Personal Data Protection Act, 2023.`,
  lead: 'How [Company legal name] collects, uses and protects personal data under India’s Digital Personal Data Protection Act, 2023.',
  readMinutes: 6,
  sections: sections([
    {
      title: 'Who we are',
      plain: [`We are the company behind ${domain}.`, 'This page follows India’s DPDP Act, 2023.'],
      body: [
        `[Company legal name] (“${brand}”, “we”) runs ${domain} from [Registered address]. This policy explains how we handle personal data as a Data Fiduciary under the Digital Personal Data Protection Act, 2023 (DPDP Act).`,
      ],
    },
    {
      title: 'Data we collect',
      plain: [
        'Your account details and what you put in your store.',
        'Card and UPI details stay with the payment partner, not us.',
      ],
      body: [
        'Account details (name, email, phone), the store data you add, billing details handled by our payment partners, device and usage data, and messages you send to support.',
      ],
    },
    {
      title: 'Why we use it',
      plain: ['To run your store and keep it safe.', 'Marketing only if you say yes.'],
      body: [
        `To run and secure ${brand}, bill you, answer support, improve the product and meet legal duties. We send marketing only with your consent.`,
      ],
    },
    {
      title: 'Consent and your choices',
      plain: ['You can take back your consent any time.', 'One link, no emails needed.'],
      body: [
        'We process personal data with your consent or for legitimate uses allowed by the DPDP Act. You can withdraw consent any time at [Consent link]; this does not affect processing done before.',
      ],
    },
    {
      title: 'Who we share it with',
      plain: [
        `Only partners who help run ${brand}, under contract.`,
        'Authorities only when the law says so.',
      ],
      body: [
        `Service providers that help us run ${brand} (hosting, payments, email, messaging) under written contracts, and authorities when the law requires.`,
      ],
      callout: {
        title: 'We never sell personal data.',
        text: 'Not to advertisers, not to data brokers, not to anyone.',
      },
    },
    {
      title: 'Your store’s customers',
      plain: [
        'Your customers’ data is yours.',
        'We only use it to run your store, as you instruct.',
      ],
      body: [
        'For data you collect from your own customers through your store, you are the Data Fiduciary and we process it on your instructions as your Data Processor.',
      ],
    },
    {
      title: 'How long we keep it',
      plain: [
        'Kept while your account is open, then deleted.',
        'Some records stay longer only if the law requires.',
      ],
      body: [
        'While your account is active and for [Retention period] after, or longer where the law requires. Then we delete or anonymise it.',
      ],
    },
    {
      title: 'Your rights',
      plain: ['See, fix or delete your data.', 'Name someone to act for you.'],
      body: [
        'You can ask to access, correct, update or erase your personal data, nominate someone to act for you, and raise a grievance. Write to [Privacy email].',
      ],
    },
    {
      title: 'Grievance officer',
      plain: ['A named person handles complaints.', 'We reply within a fixed time.'],
      body: ['[Grievance officer name], [Email], [Address]. We reply within [Response time].'],
      callout: {
        title: 'Not happy with our answer?',
        text: 'You can take your complaint to the Data Protection Board of India.',
      },
    },
  ]),
}
