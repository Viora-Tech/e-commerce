import 'server-only'
import { settingsSecret } from '@commerce/config'
import { contactInput, identifierHash } from '@commerce/plugin-chatwoot/contact'
import {
  chatwootSettingsFromApps,
  loadCustomerFacts,
  readSecret,
} from '@commerce/plugin-chatwoot/server'
import { chatwootWidgetOf } from '@commerce/plugin-chatwoot/settings'
import type { ChatwootIdentity, ChatwootWidget } from '@commerce/plugin-chatwoot/widget'
import { currentCustomer } from './customer-session'
import { inStore } from './store-context'

export type ChatwootChat = { widget: ChatwootWidget; identity: ChatwootIdentity | null }

/**
 * The store's Chatwoot chat for this request, from its `store.apps` entry: null unless the app
 * is installed with an address and a website token. A signed-in shopper comes with their
 * identity, signed with the inbox's HMAC secret (`identifier_hash`), so Chatwoot shows their
 * name and order history and nobody can chat as them. Only read when a shopper is signed in
 * (their pages are never shared by the edge cache, `lib/edge-cache.ts`). The consent banner
 * decides when the widget loads (`components/privacy/consent-manager.tsx`).
 */
export async function chatwootChatFor(
  storeId: string,
  apps: unknown,
): Promise<ChatwootChat | null> {
  const { installed, settings } = chatwootSettingsFromApps(apps)
  if (!installed) return null
  const widget = chatwootWidgetOf(settings)
  if (!widget) return null
  const secret = settingsSecret()
  const hmac = settings.identifyShoppers ? readSecret(settings.hmacToken, secret) : null
  if (!hmac) return { widget, identity: null }
  const me = await currentCustomer(storeId)
  if (!me) return { widget, identity: null }
  const facts = await inStore(storeId, (tx) => loadCustomerFacts(tx, me.id, secret))
  if (!facts) return { widget, identity: null }
  // The same identifier and fields the contact sync writes, so both land on one contact.
  const contact = contactInput(facts)
  return {
    widget,
    identity: {
      identifier: contact.identifier,
      identifierHash: identifierHash(hmac, contact.identifier),
      name: contact.name ?? null,
      email: contact.email ?? null,
      phone: contact.phone_number ?? null,
      attributes: contact.custom_attributes,
    },
  }
}
