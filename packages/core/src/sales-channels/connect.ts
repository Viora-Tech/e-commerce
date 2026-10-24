/** SOURCE OF TRUTH: sales channel connections — WHAT: connect, callback, pause, resume, disconnect / WHY: access is saved encrypted per store */
/**
 * Sales channels, the live connections: "Connect" sends the merchant to Meta or Google to sign
 * in (or, for ChatGPT, takes the feed endpoint and key OpenAI gave them), the callback saves the
 * access (encrypted) and finds the catalog, and the channel moves to `first_sync`. Pause, resume
 * and disconnect live here too. Where no platform app is configured, Connect stays a request.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { siteConfig } from '@commerce/config/site'
import {
  type ChannelProvider,
  channelConnection,
  channelListing,
  type Db,
  store,
  withStore,
} from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { linkPlatformAccount, unlinkPlatformAccount } from '../platform-apps/accounts'
import { decryptSecret, encryptSecret } from '../secrets'
import {
  type ChannelState,
  type ConnectRequest,
  ConnectRequestSchema,
  channelState,
  isLive,
  NOT_CONNECTED,
  type SalesChannelId,
} from './client'
import {
  type GoogleMerchantApp,
  googleDiscover,
  googleExchangeCode,
  googleMerchantAuthorizeUrl,
} from './google-merchant'
import {
  ChannelApiError,
  type MetaApp,
  metaAuthorizeUrl,
  metaDiscover,
  metaExchangeCode,
  metaLinkWhatsapp,
} from './providers'
import { loadSalesChannelSettings, patchChannelStates, requestChannel } from './service'

/** Which platform connection serves a channel; null where only a request is possible yet. */
export const PROVIDER_OF: Record<SalesChannelId, ChannelProvider | null> = {
  instagram: 'meta',
  facebook: 'meta',
  whatsapp: 'meta',
  google: 'google',
  chatgpt: 'openai',
  google_ai: null,
  perplexity: null,
  copilot: null,
}

export const channelsOf = (provider: ChannelProvider): SalesChannelId[] =>
  (Object.keys(PROVIDER_OF) as SalesChannelId[]).filter((c) => PROVIDER_OF[c] === provider)

/** What connecting and syncing need from the host. */
export type ChannelDeps = {
  fetch: typeof fetch
  /** SETTINGS_SECRET: encrypts tokens and signs the OAuth state. */
  secret: string
  meta: MetaApp | null
  google: GoogleMerchantApp | null
  /** The admin's public origin: OAuth callbacks come back here. */
  adminUrl: string
  /** The storefront origin when a store has no domain of its own (product links). */
  storefrontUrl: string
}

/** Meta's and Google's app keys from the environment; null turns that Connect into a request. */
export function channelApps(env: Record<string, string | undefined>): {
  meta: MetaApp | null
  google: GoogleMerchantApp | null
} {
  const metaId = env.META_APP_ID?.trim()
  const metaSecret = env.META_APP_SECRET?.trim()
  const gid = env.GMC_GOOGLE_CLIENT_ID?.trim() || env.MERCHANT_GOOGLE_CLIENT_ID?.trim()
  const gsecret = env.GMC_GOOGLE_CLIENT_SECRET?.trim() || env.MERCHANT_GOOGLE_CLIENT_SECRET?.trim()
  return {
    meta:
      metaId && metaSecret
        ? {
            appId: metaId,
            appSecret: metaSecret,
            loginConfigId: env.META_LOGIN_CONFIG_ID?.trim() || null,
          }
        : null,
    google: gid && gsecret ? { clientId: gid, clientSecret: gsecret } : null,
  }
}

/** Whether Connect for this channel signs in to the platform now (rather than asking). */
export function canConnectNow(channel: SalesChannelId, deps: Pick<ChannelDeps, 'meta' | 'google'>) {
  const provider = PROVIDER_OF[channel]
  if (provider === 'meta') return deps.meta !== null
  if (provider === 'google') return deps.google !== null
  return false
}

const callbackUrl = (adminUrl: string, provider: 'meta' | 'google') =>
  `${adminUrl.replace(/\/+$/, '')}/api/channels/${provider}/callback`

/* ---------- the signed OAuth state ---------- */

const STATE_TTL_MS = 30 * 60_000

const mac = (payload: string, secret: string) =>
  createHmac('sha256', `channel-oauth:${secret}`).update(payload).digest('base64url')

type StatePayload = {
  storeId: string
  channel: SalesChannelId
  catalog: 'all' | 'collections'
  n: string
  exp: number
}

export function signChannelState(
  input: Omit<StatePayload, 'n' | 'exp'>,
  secret: string,
  now = new Date(),
): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ ...input, n: nonce, exp: now.getTime() + STATE_TTL_MS }),
  ).toString('base64url')
  return { state: `${payload}.${mac(payload, secret)}`, nonce }
}

export function verifyChannelState(
  raw: string,
  secret: string,
  now = new Date(),
): StatePayload | null {
  const [payload, given] = raw.split('.')
  if (!payload || !given) return null
  const expected = Buffer.from(mac(payload, secret))
  const actual = Buffer.from(given)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as StatePayload
    if (typeof s.storeId !== 'string' || typeof s.channel !== 'string' || s.exp < now.getTime())
      return null
    return s
  } catch {
    return null
  }
}

/** PKCE verifier from the nonce, so nothing is stored between Connect and the callback. */
const pkceVerifier = (nonce: string, secret: string) =>
  createHmac('sha256', `channel-pkce:${secret}`).update(nonce).digest('base64url')

/** PKCE S256: base64url(sha256(verifier)). */
const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url')

/* ---------- connections ---------- */

type ConnectionRow = typeof channelConnection.$inferSelect

export async function loadConnection(
  ctx: StoreContext,
  provider: ChannelProvider,
): Promise<ConnectionRow | null> {
  const [row] = await ctx.tx
    .select()
    .from(channelConnection)
    .where(
      and(eq(channelConnection.storeId, ctx.storeId), eq(channelConnection.provider, provider)),
    )
  return row ?? null
}

export const readToken = (blob: string, secret: string) => decryptSecret(blob, secret)

async function saveConnection(
  ctx: StoreContext,
  provider: ChannelProvider,
  values: {
    accessToken: string
    refreshToken?: string | null
    expiresAt?: Date | null
    accountId?: string | null
    accountName?: string | null
    target?: string | null
    extra?: Record<string, string>
  },
  secret: string,
  now: Date,
): Promise<void> {
  const row = {
    accessToken: encryptSecret(values.accessToken, secret),
    refreshToken: values.refreshToken ? encryptSecret(values.refreshToken, secret) : null,
    expiresAt: values.expiresAt ?? null,
    accountId: values.accountId ?? null,
    accountName: values.accountName ?? null,
    target: values.target ?? null,
    extra: values.extra ?? {},
    updatedAt: now,
  }
  await ctx.tx
    .insert(channelConnection)
    .values({ storeId: ctx.storeId, provider, ...row, createdAt: now })
    .onConflictDoUpdate({
      target: [channelConnection.storeId, channelConnection.provider],
      set: row,
    })
}

const firstSync = (
  account: string | null,
  catalog: 'all' | 'collections',
  now: Date,
): ChannelState => ({
  ...NOT_CONNECTED,
  status: 'first_sync',
  requestedAt: now.toISOString(),
  shares: ['catalog', 'prices'],
  account,
  catalog,
})

export type ConnectStart =
  | { kind: 'redirect'; url: string }
  | { kind: 'connected'; state: ChannelState }
  | { kind: 'requested'; state: ChannelState }

/**
 * "Connect": with Meta or Google set up, the URL to sign in at (or, when this store already
 * connected that platform for another channel, the channel joins it straight away). Otherwise
 * the old request, which the platform team approves.
 */
export async function startChannelConnect(
  ctx: StoreContext,
  input: ConnectRequest,
  deps: ChannelDeps,
  now = new Date(),
): Promise<ConnectStart> {
  const req = ConnectRequestSchema.parse(input)
  const provider = PROVIDER_OF[req.channel]
  if (!canConnectNow(req.channel, deps) || (provider !== 'meta' && provider !== 'google'))
    return { kind: 'requested', state: await requestChannel(ctx, req, now) }

  const existing = await loadConnection(ctx, provider)
  if (existing && (!existing.expiresAt || existing.expiresAt > now || existing.refreshToken)) {
    const state = firstSync(existing.accountName, req.catalog, now)
    if (
      req.channel === 'whatsapp' &&
      provider === 'meta' &&
      deps.meta &&
      existing.extra.wabaId &&
      existing.target
    ) {
      await metaLinkWhatsapp(
        deps.fetch,
        deps.meta,
        readToken(existing.accessToken, deps.secret),
        existing.extra.wabaId,
        existing.target,
      ).catch(() => undefined)
    }
    await patchChannelStates(ctx, { [req.channel]: state })
    return { kind: 'connected', state }
  }

  const { state, nonce } = signChannelState(
    { storeId: ctx.storeId, channel: req.channel, catalog: req.catalog },
    deps.secret,
    now,
  )
  const redirectUri = callbackUrl(deps.adminUrl, provider)
  if (provider === 'meta' && deps.meta)
    return {
      kind: 'redirect',
      url: metaAuthorizeUrl({
        appId: deps.meta.appId,
        redirectUri,
        state,
        configId: deps.meta.loginConfigId ?? null,
      }),
    }
  if (provider === 'google' && deps.google)
    return {
      kind: 'redirect',
      url: googleMerchantAuthorizeUrl({
        clientId: deps.google.clientId,
        redirectUri,
        state,
        codeChallenge: pkceChallenge(pkceVerifier(nonce, deps.secret)),
      }),
    }
  return { kind: 'requested', state: await requestChannel(ctx, req, now) }
}

/**
 * The platform sent the merchant back with a code: swap it, find (or make) the catalog, save
 * the access, and start the first sync. The state names the store, so this runs without one.
 */
export async function completeChannelConnect(
  db: Db,
  input: { provider: 'meta' | 'google'; code: string; state: string },
  deps: ChannelDeps,
  now = new Date(),
): Promise<{ storeId: string; channel: SalesChannelId }> {
  const s = verifyChannelState(input.state, deps.secret, now)
  if (!s || PROVIDER_OF[s.channel] !== input.provider)
    throw new ChannelApiError('api', 'This sign-in link expired. Start Connect again.')
  const [named, current] = await withStore(db, s.storeId, (tx) =>
    Promise.all([
      tx
        .select({ name: store.name })
        .from(store)
        .where(eq(store.id, s.storeId))
        .then((rows) => rows[0]),
      loadConnection({ tx, storeId: s.storeId }, input.provider),
    ]),
  )
  const catalogName = `${named?.name ?? 'Store'} (${siteConfig.brand.name})`
  const redirectUri = callbackUrl(deps.adminUrl, input.provider)

  if (input.provider === 'meta') {
    if (!deps.meta) throw new ChannelApiError('api', 'Facebook connections are not set up.')
    const { token, expiresAt } = await metaExchangeCode(deps.fetch, deps.meta, {
      code: input.code,
      redirectUri,
    })
    const account = await metaDiscover(
      deps.fetch,
      deps.meta,
      token,
      catalogName,
      current?.target ?? null,
    )
    if (s.channel === 'whatsapp' && account.wabaId)
      await metaLinkWhatsapp(deps.fetch, deps.meta, token, account.wabaId, account.catalogId).catch(
        () => undefined,
      )
    await withStore(db, s.storeId, async (tx) => {
      const ctx = { tx, storeId: s.storeId }
      await saveConnection(
        ctx,
        'meta',
        {
          accessToken: token,
          expiresAt,
          accountId: account.businessId,
          accountName: account.businessName,
          target: account.catalogId,
          extra: {
            ...(account.wabaId ? { wabaId: account.wabaId } : {}),
            ...(account.userId ? { userId: account.userId } : {}),
          },
        },
        deps.secret,
        now,
      )
      // Meta's deauthorize and data deletion callbacks name only this user.
      if (account.userId)
        await linkPlatformAccount(
          ctx,
          'meta',
          account.userId,
          { business: account.businessName },
          now,
        )
      await patchChannelStates(ctx, {
        [s.channel]: firstSync(account.businessName, s.catalog, now),
      })
    })
    return { storeId: s.storeId, channel: s.channel }
  }

  if (!deps.google) throw new ChannelApiError('api', 'Google connections are not set up.')
  const tokens = await googleExchangeCode(deps.fetch, deps.google, {
    code: input.code,
    redirectUri,
    codeVerifier: pkceVerifier(s.n, deps.secret),
  })
  if (!tokens.refreshToken)
    throw new ChannelApiError(
      'api',
      'Google did not give lasting access. Connect again and allow it.',
    )
  const account = await googleDiscover(deps.fetch, tokens.accessToken, catalogName)
  await withStore(db, s.storeId, async (tx) => {
    const ctx = { tx, storeId: s.storeId }
    await saveConnection(
      ctx,
      'google',
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        accountId: account.accountId,
        accountName: account.accountName,
        target: account.dataSource,
      },
      deps.secret,
      now,
    )
    await patchChannelStates(ctx, { [s.channel]: firstSync(account.accountName, s.catalog, now) })
  })
  return { storeId: s.storeId, channel: s.channel }
}

export const OpenAiFeedSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((u) => u.startsWith('https://'), 'The feed address must start with https://'),
  apiKey: z.string().trim().min(8).max(500),
})

/** ChatGPT after OpenAI approved the store: the feed address and key they gave. */
export async function saveOpenAiFeed(
  ctx: StoreContext,
  input: z.input<typeof OpenAiFeedSchema>,
  secret: string,
  now = new Date(),
): Promise<ChannelState> {
  const req = OpenAiFeedSchema.parse(input)
  await saveConnection(
    ctx,
    'openai',
    { accessToken: req.apiKey, target: req.endpoint, accountName: new URL(req.endpoint).host },
    secret,
    now,
  )
  const settings = await loadSalesChannelSettings(ctx)
  const before = channelState(settings, 'chatgpt')
  const state: ChannelState = {
    ...firstSync(new URL(req.endpoint).host, 'all', now),
    shares: before.shares.length ? before.shares : ['catalog', 'prices'],
  }
  await patchChannelStates(ctx, { chatgpt: state })
  return state
}

/** Pause stops syncing (the platform keeps what it has); resume syncs again. */
export async function setChannelPaused(
  ctx: StoreContext,
  channel: SalesChannelId,
  paused: boolean,
  now = new Date(),
): Promise<ChannelState> {
  const settings = await loadSalesChannelSettings(ctx)
  const current = channelState(settings, channel)
  if (!isLive(current)) return current
  const next: ChannelState = paused
    ? { ...current, status: 'paused', sync: { ...current.sync, endedAt: now.toISOString() } }
    : { ...current, status: 'first_sync', sync: { ...current.sync, endedAt: null, message: null } }
  await patchChannelStates(ctx, { [channel]: next })
  return next
}

/**
 * Disconnect: the channel ends; once no channel uses the platform any more, its saved access
 * and listing records go too.
 */
export async function disconnectChannel(
  ctx: StoreContext,
  channel: SalesChannelId,
  now = new Date(),
): Promise<ChannelState> {
  const settings = await loadSalesChannelSettings(ctx)
  const current = channelState(settings, channel)
  const next: ChannelState = {
    ...current,
    status: 'disconnected',
    sync: { ...current.sync, endedAt: now.toISOString(), message: null },
  }
  await patchChannelStates(ctx, { [channel]: next })
  const provider = PROVIDER_OF[channel]
  if (!provider) return next
  const others = channelsOf(provider).filter(
    (c) =>
      c !== channel &&
      isLive(channelState(settings, c)) &&
      channelState(settings, c).status !== 'disconnected',
  )
  if (!others.length) {
    await ctx.tx
      .delete(channelListing)
      .where(and(eq(channelListing.storeId, ctx.storeId), eq(channelListing.provider, provider)))
    await ctx.tx
      .delete(channelConnection)
      .where(
        and(eq(channelConnection.storeId, ctx.storeId), eq(channelConnection.provider, provider)),
      )
    if (provider === 'meta') await unlinkPlatformAccount(ctx, 'meta')
  }
  return next
}
