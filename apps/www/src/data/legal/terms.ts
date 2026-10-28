import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const brand = siteConfig.brand.name
const company = 'Viora India (a sole proprietorship of Kuldeep Saini)'

export const termsDoc: LegalDoc = {
  slug: 'terms',
  title: 'Terms of use',
  description: `The agreement between you and Viora India for using ${brand}.`,
  lead: `The agreement between you and ${company} for using ${brand}.`,
  readMinutes: 5,
  sections: sections([
    {
      title: 'Agreement',
      plain: [
        `Using ${brand} means you accept these terms.`,
        'You accept them for your business too.',
      ],
      body: [
        `By creating an account or using ${brand} you agree to these terms on behalf of yourself or the business you represent.`,
      ],
    },
    {
      title: 'Your account',
      plain: ['Keep your password safe.', 'Tell us fast if something looks wrong.'],
      body: [
        `Keep your sign-in details safe and tell us at ${siteConfig.contact.supportEmail} if you suspect misuse. You are responsible for activity on your account.`,
      ],
    },
    {
      title: 'Plans and billing',
      plain: [
        'Billed in advance in rupees, plus GST.',
        'Past your included orders, a small fee per order, billed monthly.',
      ],
      body: [
        'Paid plans are billed monthly or yearly, as you choose, in advance in INR, plus applicable GST.',
        'Each plan includes a number of orders per calendar month (India time). Every further order placed while you are on a paid plan carries the plan’s per-order fee, a percentage of the order’s total as the buyer paid it, shipping and tax included. Cancelled orders, orders refunded in full before the bill is made, and test orders do not count; cash on delivery orders and partly refunded orders count in full. Orders during a free trial, or while a plan is unpaid or paused, carry no fee.',
        'Per-order fees are billed once a month, on the 1st, for the month before, with a GST invoice. A month whose fees come to less than ₹100 is carried to the next month instead. A fee bill left unpaid does not pause your store; it is added to your next plan bill, and that bill’s payment terms then apply.',
        'Each plan states a fair-use number of storefront visits a month. If your store is over it two months running, we will contact you to agree the right plan. We never block, slow down or charge for visits automatically.',
      ],
    },
    {
      title: 'Your content',
      plain: ['Your products, photos and text stay yours.', 'We only use them to run your store.'],
      body: [
        `You own your store content. You give us the rights needed to host and show it to run ${brand} for you.`,
      ],
      callout: {
        title: 'You own your store.',
        text: 'Download everything any time from Settings → General.',
      },
    },
    {
      title: 'Connected platforms',
      plain: [
        'Meta, Google and Shopify have their own terms too.',
        'You choose what to connect and can disconnect any time.',
      ],
      body: [
        `${brand} can connect to accounts you hold on other platforms: Meta (Facebook and Instagram catalog, WhatsApp Business), Google Merchant Center and Shopify (to move your store). When you connect one, you authorise ${brand} to act on the assets you chose, only for the feature you turned on, and you remain bound by that platform’s own terms and policies (for example Meta’s Commerce and WhatsApp Business policies and Google’s Merchant Center policies).`,
        'WhatsApp message charges are billed by Meta to your own WhatsApp Business account. A platform may limit, review or reject your account, products or messages; we show you what it reports but cannot overrule it. How we handle data from these platforms is in our privacy policy, and how to delete it is on our data deletion page.',
      ],
    },
    {
      title: 'Ending the agreement',
      plain: ['Leave whenever you want.', 'We give notice before suspending, where we can.'],
      body: [
        'You can close your store any time from Settings. We may end or suspend accounts that break these terms, with notice where possible.',
      ],
    },
    {
      title: 'Liability',
      plain: [
        'Our total liability is capped at what you paid us in the last 12 months.',
        'We are not liable for indirect losses such as lost profits.',
      ],
      body: [
        `To the extent the law allows, ${brand} is provided “as is”, and Viora India’s total liability for all claims arising out of or relating to these terms or ${brand} is limited to the fees you paid us in the 12 months before the event giving rise to the claim. We are not liable for indirect, incidental, special or consequential losses, including lost profits, revenue, data or goodwill. Nothing in these terms limits liability that cannot be limited under Indian law, such as for fraud.`,
      ],
    },
    {
      title: 'Governing law',
      plain: ['Indian law applies.', 'Disputes go to courts in Sonipat, Haryana.'],
      body: [
        'These terms are governed by the laws of India. Courts at Sonipat, Haryana have exclusive jurisdiction.',
      ],
    },
  ]),
}
