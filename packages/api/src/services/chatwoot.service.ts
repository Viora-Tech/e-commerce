import { encryptSecret, parseAppsSettings, withAppSettings } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { ChatwootError, parseTrustedOrigins } from '@commerce/plugin-chatwoot/client'
import {
  type ChatwootConversationsView,
  chatwootApi,
  chatwootConversationsFor,
  loadChatwootSettings,
  loadCustomerFacts,
  orderContactOf,
} from '@commerce/plugin-chatwoot/server'
import {
  accountIdFromUrl,
  CHATWOOT_ID,
  type ChatwootSettings,
  type ChatwootSettingsPatch,
  type ChatwootSettingsView,
  chatwootSettingsView,
  isAccountId,
  isWebsiteToken,
  normaliseChatwootUrl,
} from '@commerce/plugin-chatwoot/settings'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'

/** The secrets and addresses the service needs from the environment. */
export type ChatwootEnv = {
  secret: string
  /** `CHATWOOT_TRUSTED_ORIGINS`, raw. */
  trustedOrigins: string | undefined
}

const badRequest = (message: string) => new ORPCError('BAD_REQUEST', { message })

async function write(tx: StoreTx, storeId: string, next: ChatwootSettings) {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  await tx
    .update(store)
    .set({ apps: withAppSettings(parseAppsSettings(s?.apps), CHATWOOT_ID, next) })
    .where(eq(store.id, storeId))
}

function apiFor(settings: ChatwootSettings, env: ChatwootEnv) {
  return chatwootApi(settings, env.secret, {
    trustedOrigins: parseTrustedOrigins(env.trustedOrigins),
  })
}

export async function getChatwootSettings(
  tx: StoreTx,
  storeId: string,
): Promise<ChatwootSettingsView> {
  return chatwootSettingsView((await loadChatwootSettings(tx, storeId)).settings)
}

/** Saves the form. The address is normalised, the ids checked, new secrets encrypted. */
export async function saveChatwootSettings(
  tx: StoreTx,
  storeId: string,
  patch: ChatwootSettingsPatch,
  env: ChatwootEnv,
): Promise<ChatwootSettingsView> {
  const { settings } = await loadChatwootSettings(tx, storeId)
  const next: ChatwootSettings = { ...settings }
  if (patch.baseUrl !== undefined) {
    if (patch.baseUrl === '') next.baseUrl = ''
    else {
      const url = normaliseChatwootUrl(patch.baseUrl)
      if (!url) throw badRequest('That does not look like a web address.')
      next.baseUrl = url
      // A pasted dashboard link carries the account id too.
      const fromLink = accountIdFromUrl(patch.baseUrl)
      if (fromLink && !patch.accountId) next.accountId = fromLink
    }
  }
  if (patch.accountId !== undefined) {
    if (patch.accountId !== '' && !isAccountId(patch.accountId)) {
      throw badRequest('The account id is a number, like the 3 in /app/accounts/3/dashboard.')
    }
    next.accountId = patch.accountId
  }
  if (patch.websiteToken !== undefined) {
    if (patch.websiteToken !== '' && !isWebsiteToken(patch.websiteToken)) {
      throw badRequest(
        'That is not a website token. Copy it from your website inbox’s settings in Chatwoot.',
      )
    }
    next.websiteToken = patch.websiteToken
  }
  if (patch.apiToken !== undefined) {
    next.apiToken = patch.apiToken === '' ? '' : encryptSecret(patch.apiToken, env.secret)
  }
  if (patch.hmacToken !== undefined) {
    next.hmacToken = patch.hmacToken === '' ? '' : encryptSecret(patch.hmacToken, env.secret)
  }
  if (patch.consent !== undefined) next.consent = patch.consent
  if (patch.identifyShoppers !== undefined) next.identifyShoppers = patch.identifyShoppers
  if (patch.syncContacts !== undefined) next.syncContacts = patch.syncContacts
  await write(tx, storeId, next)
  return chatwootSettingsView(next)
}

/**
 * Read-only check of the saved connection: the token opens the account, and the website token
 * belongs to one of its inboxes. Creates nothing in Chatwoot.
 */
export async function testChatwoot(
  tx: StoreTx,
  storeId: string,
  env: ChatwootEnv,
): Promise<{ agent: string; inbox: string | null }> {
  const { settings } = await loadChatwootSettings(tx, storeId)
  const api = apiFor(settings, env)
  if (!api) throw badRequest('Add the Chatwoot address, account id and API access token first.')
  try {
    const profile = await api.client.profile()
    if (profile.accountIds.length > 0 && !profile.accountIds.includes(settings.accountId)) {
      throw badRequest(
        `This token cannot open account ${settings.accountId}. It can open: ${profile.accountIds.join(', ')}.`,
      )
    }
    const inboxes = await api.client.inboxes()
    const inbox = settings.websiteToken
      ? inboxes.find((i) => i.websiteToken === settings.websiteToken)
      : undefined
    if (settings.websiteToken && !inbox) {
      throw badRequest('No website inbox in this account has that website token.')
    }
    return { agent: profile.name, inbox: inbox?.name ?? null }
  } catch (err) {
    if (err instanceof ChatwootError) throw badRequest(err.message)
    throw err
  }
}

/** The Conversations card on a customer's page. Never throws for a Chatwoot problem. */
export async function chatwootCustomerConversations(
  tx: StoreTx,
  storeId: string,
  customerId: string,
  env: ChatwootEnv,
): Promise<ChatwootConversationsView> {
  const { installed, settings } = await loadChatwootSettings(tx, storeId)
  if (!installed) return { state: 'not-installed' }
  const api = apiFor(settings, env)
  if (!api) return { state: 'not-connected' }
  const facts = await loadCustomerFacts(tx, customerId, env.secret)
  if (!facts) return { state: 'no-contact', dashboardUrl: api.links.dashboard }
  return chatwootConversationsFor(api, facts)
}

/** The Conversations card on an order's page: its customer's, or the order email's. */
export async function chatwootOrderConversations(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  env: ChatwootEnv,
): Promise<ChatwootConversationsView> {
  const { installed, settings } = await loadChatwootSettings(tx, storeId)
  if (!installed) return { state: 'not-installed' }
  const api = apiFor(settings, env)
  if (!api) return { state: 'not-connected' }
  const who = await orderContactOf(tx, orderId, env.secret)
  if (!who) return { state: 'no-contact', dashboardUrl: api.links.dashboard }
  return chatwootConversationsFor(api, who)
}
