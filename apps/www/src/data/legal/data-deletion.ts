import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const brand = siteConfig.brand.name
const support = siteConfig.contact.supportEmail
const admin = siteConfig.urls.admin

export const dataDeletionDoc: LegalDoc = {
  slug: 'data-deletion',
  title: 'Data deletion',
  description: `How to delete the data ${brand} holds about you, including data from Facebook, Instagram, WhatsApp, Google and Shopify.`,
  lead: `How to delete the data ${brand} holds about you, including what we received when you connected Facebook, Instagram, WhatsApp, Google or Shopify.`,
  readMinutes: 4,
  sections: sections([
    {
      title: 'What can be deleted',
      plain: [
        'Platform access goes the moment you disconnect.',
        'Your whole account can be deleted on request.',
      ],
      body: [
        `For a connected platform we hold an encrypted access token, the ids of the accounts you chose (business, catalog, WhatsApp Business account, Merchant Center account or Shopify shop) and sync records. Deleting a connection removes these. Deleting your ${brand} account removes your store and its data, apart from records the law makes us keep (such as tax invoices).`,
      ],
    },
    {
      title: 'Facebook, Instagram and WhatsApp',
      plain: [
        'Remove our app in Facebook settings, or disconnect in the admin.',
        'Facebook gives you a code to check the status.',
      ],
      body: [
        `In the ${brand} admin (${admin}): Sales channels → Social media → Facebook or Instagram → Manage → Disconnect, and Apps → WhatsApp → Disconnect.`,
        `Or on Facebook: Settings & privacy → Settings → Business integrations (or Apps and websites) → find ${brand} → Remove, then choose to send a data deletion request. Meta tells us, we delete the Meta access, catalog listing records and account links of every store you connected straight away, and Meta shows you a confirmation code with a link to our status page.`,
        `The status page is ${admin}/api/platform/meta/deletion?code=<your confirmation code>. It shows “completed” for any code we issued.`,
      ],
    },
    {
      title: 'Google Merchant Center',
      plain: ['Disconnect in the admin.', 'Or remove access in your Google account.'],
      body: [
        `In the admin: Sales channels → Social media → Google → Manage → Disconnect. Or at https://myaccount.google.com/permissions, remove ${brand}; our next sync then fails, and you can disconnect to delete what is left. Products already sent to your Merchant Center stay in your Merchant Center, which you control.`,
      ],
    },
    {
      title: 'Shopify',
      plain: [`Uninstall the ${brand} Migration app.`, 'Its access token is deleted at once.'],
      body: [
        `In Shopify admin: Settings → Apps and sales channels → ${brand} Migration → Uninstall. Shopify tells us and we delete the shop’s access token. Records you already imported stay in your ${brand} store because they are yours; delete them there, or ask us to delete your account.`,
      ],
    },
    {
      title: 'Ask us',
      plain: ['Email us from your account email.', 'We confirm when it is done.'],
      body: [
        `Write to ${support} from the email on your account, saying what you want deleted (a connection, your store, or your whole account). We confirm by email and complete the request within 30 days.`,
      ],
    },
    {
      title: 'Customers of a store',
      plain: [
        `Shopped at a store built on ${brand}? Ask that store first.`,
        'We help the store delete your data.',
      ],
      body: [
        `A store on ${brand} decides what happens to its customers’ data. Contact the store; if you cannot reach it, write to ${support} with the store’s name and we will pass on your request and help the store complete it.`,
      ],
    },
  ]),
}
