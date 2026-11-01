import { definePlugin } from '@commerce/plugins'
import { desc, eq } from 'drizzle-orm'
import { contactMessage } from './schema'

export const FORMS_ID = 'forms'

/**
 * Forms: the contact and advice forms of an imported Shopify theme (`{% form 'contact' %}`).
 * Each submission is saved here and emailed to the store's contact address. Without the app
 * the theme's form shows "unavailable". Own code throughout; no open-source app was a
 * clearly better fit for a message table and one email (see docs/open-source-radar.md).
 */
export const formsPlugin = definePlugin({
  id: FORMS_ID,
  name: 'Forms',
  version: '1.0.0',
  kind: 'builtin',
  category: 'marketing',
  description:
    'Make the contact and advice forms of your theme work: every message is saved here and emailed to you.',
  listing: {
    tagline: 'Makes the contact forms of an imported theme work, with every message saved.',
    highlights: ['Saves every message on a Submissions page', 'Emails each one to your store'],
    worksWith: ['Themes imported from Shopify'],
    keywords: ['contact form', 'messages'],
    faq: [
      {
        question: 'Do I need this app?',
        answer:
          'Only if your theme was imported from Shopify and has contact forms. Without it, those forms have nowhere to send.',
      },
      {
        question: 'Where do the messages go?',
        answer:
          'Each one is saved on the app’s Submissions page and emailed to your store’s address.',
      },
    ],
  },
  access: {
    resources: [
      {
        resource: 'customers',
        level: 'write',
        why: 'Saves the messages shoppers send from your theme’s forms',
      },
    ],
    summary: 'saves messages',
  },
  // The newest contactMessage is the app's last use, for the Installed apps list.
  lastUsed: async (tx, storeId) => {
    const [row] = await tx
      .select({ at: contactMessage.createdAt })
      .from(contactMessage)
      .where(eq(contactMessage.storeId, storeId))
      .orderBy(desc(contactMessage.createdAt))
      .limit(1)
    return row ? { at: row.at, summary: 'Got a form message' } : null
  },
  provides: {},
  admin: {
    icon: 'Inbox',
    pages: [{ path: '', title: 'Submissions', navLabel: 'Submissions', icon: 'Inbox' }],
  },
})
