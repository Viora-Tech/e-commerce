import { type AppHookContext, definePlugin } from '@commerce/plugins'
import { type ChatwootClientOptions, parseTrustedOrigins } from './client'
import {
  chatwootApi,
  loadChatwootSettings,
  loadCustomerFacts,
  orderContactOf,
  syncChatwootContact,
} from './server'
import { CHATWOOT_ID, chatwootSettingsView, parseChatwootSettings } from './settings'

type SyncDeps = Pick<ChatwootClientOptions, 'fetch' | 'lookup' | 'trustedOrigins'>

/**
 * Upsert one customer's Chatwoot contact. Reads the store in one transaction, then calls
 * Chatwoot outside it. Does nothing while the store turned syncing off or the API is not set
 * up; a Chatwoot error throws so the worker retries with backoff.
 */
export async function syncCustomerToChatwoot(
  ctx: Pick<AppHookContext, 'storeId' | 'inStore' | 'settingsSecret' | 'reportActivity'>,
  customerId: string,
  deps: SyncDeps = { trustedOrigins: parseTrustedOrigins(process.env.CHATWOOT_TRUSTED_ORIGINS) },
): Promise<void> {
  const read = await ctx.inStore(async (tx) => {
    const { settings } = await loadChatwootSettings(tx, ctx.storeId)
    if (!settings.syncContacts) return null
    const facts = await loadCustomerFacts(tx, customerId, ctx.settingsSecret)
    return facts ? { settings, facts } : null
  })
  if (!read) return
  const api = chatwootApi(read.settings, ctx.settingsSecret, deps)
  if (!api) return
  const result = await syncChatwootContact(api.client, read.facts)
  if (result.action !== 'unchanged') {
    const who = read.facts.name ?? read.facts.email ?? 'a customer'
    ctx.reportActivity?.(
      result.action === 'created' ? `Added ${who} to Chatwoot` : `Updated ${who} in Chatwoot`,
    )
  }
}

/**
 * Support inbox through Chatwoot (MIT outside its `enterprise/` folder, which we never use).
 * The storefront loads the store's Chatwoot website widget (after the cookie category the store
 * picked), signed-in shoppers are identified with an HMAC so their chats carry their name and
 * order history, every customer is kept as a Chatwoot contact (outbox `customer.*` events and
 * payments, through the worker), and the customer and order pages list their conversations.
 * Chatwoot runs elsewhere (Chatwoot Cloud or self-hosted); no Chatwoot code is copied here.
 */
export const chatwootPlugin = definePlugin({
  id: CHATWOOT_ID,
  name: 'Chatwoot',
  version: '1.0.0',
  kind: 'connection',
  category: 'messages',
  company: 'Chatwoot',
  description:
    'A support inbox for your store: live chat on every page, with each shopper’s orders beside the chat, and their conversations on the customer and order pages.',
  listing: {
    tagline: 'Live chat and a shared support inbox, with each shopper’s orders beside the chat.',
    highlights: [
      'Chat on every page of your store, in your own theme or an imported one',
      'Signed-in shoppers arrive with their name, orders and total spent',
      'Their conversations on the customer and order pages',
    ],
    guide: '/merchant-guide/apps/chatwoot',
    worksWith: ['A Chatwoot Cloud account or your own Chatwoot server'],
    keywords: ['chat', 'support', 'helpdesk'],
  },
  access: {
    resources: [
      {
        resource: 'customers',
        level: 'read',
        why: 'Name, email, phone and order totals for each Chatwoot contact',
      },
      { resource: 'orders', level: 'read', why: 'Order count, total spent and the last order' },
    ],
    summary: 'syncs contacts',
    shares: [
      {
        when: 'When a customer signs up, changes their details or pays',
        what: 'Name, email, phone, customer since, orders count, total spent, last order',
      },
      {
        when: 'When a signed-in shopper opens a page with the chat',
        what: 'The same details, to start their chat as them',
      },
    ],
  },
  setupState: (raw) => {
    const view = chatwootSettingsView(parseChatwootSettings(raw))
    return { connected: view.chat || view.api, problem: null }
  },
  provides: {},
  hooks: {
    'customer.created': async (ctx, payload) => {
      if (payload.customerId) await syncCustomerToChatwoot(ctx, payload.customerId)
    },
    'customer.updated': async (ctx, payload) => {
      if (payload.customerId) await syncCustomerToChatwoot(ctx, payload.customerId)
    },
    // A payment changes the orders count and total spent beside the chat.
    'order.paid': async (ctx, payload) => {
      const who = await ctx.inStore((tx) => orderContactOf(tx, payload.orderId, ctx.settingsSecret))
      if (who?.id) await syncCustomerToChatwoot(ctx, who.id)
    },
  },
  credits: [
    {
      name: 'Chatwoot',
      url: 'https://github.com/chatwoot/chatwoot',
      license: 'MIT',
      note: 'Support inbox: its website widget and API (the MIT part; nothing from enterprise/)',
    },
  ],
  admin: {
    icon: 'MessageSquare',
    pages: [{ path: '', title: 'Settings', navLabel: 'Settings', icon: 'Settings' }],
    orderDetailCard: true,
    customerDetailCard: true,
  },
})
