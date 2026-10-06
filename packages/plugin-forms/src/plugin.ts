import { definePlugin } from '@commerce/plugins'

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
  provides: {},
  admin: {
    icon: 'Inbox',
    pages: [{ path: '', title: 'Submissions', navLabel: 'Submissions', icon: 'Inbox' }],
  },
})
