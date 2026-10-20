/** SOURCE OF TRUTH: gateway Live/Test key sets and Active/Inactive — WHAT a gateway's two key sets and on/off switch are / WHY flipping either never loses a saved key */
import { type CheckoutMethod, enabledForMethods, isGatewayProvider } from './methods'

/*
 * Pure (no database, no gateway SDK), so admin client components import it
 * through `@commerce/core/payment-modes`.
 *
 * Every gateway keeps two key sets, test and live. The one checkout uses is
 * stored where it always was, `providers[id]`, so checkout, webhooks, refunds
 * and token refresh read it unchanged. The other one waits under
 * `providers['<id>~<mode>']` until the merchant flips the switch, which swaps
 * the two. A set's mode is read from the keys themselves (Razorpay's
 * `rzp_test_` / `rzp_live_` prefix, Cashfree's and Decentro's `mode` field), so
 * the switch can never disagree with where the money actually goes, and a store
 * saved before there were two sets needs no migration: its one set is simply the
 * active set, in the slot its keys say.
 */

export type PaymentMode = 'test' | 'live'

export const PAYMENT_MODES: readonly PaymentMode[] = ['test', 'live']

/** Gateways with a Live ⇄ Test switch and an Active/Inactive switch. */
export const MODE_GATEWAY_IDS = ['razorpay', 'cashfree', 'decentro'] as const

type Providers = Record<string, Record<string, string>>

const SEP = '~'

/** Where a gateway's waiting (not in use) key set for `mode` is stored. */
export const parkedKey = (id: string, mode: PaymentMode): string => `${id}${SEP}${mode}`

/** True for a `providers` key that holds a waiting key set rather than a provider's config. */
export const isParkedKey = (key: string): boolean => key.includes(SEP)

/** The provider id a `providers` key belongs to (`razorpay~live` → `razorpay`). */
export const baseProviderId = (key: string): string => key.split(SEP)[0] ?? key

export const otherMode = (mode: PaymentMode): PaymentMode => (mode === 'test' ? 'live' : 'test')

const hasValues = (cfg: Record<string, string> | undefined): cfg is Record<string, string> =>
  !!cfg && Object.values(cfg).some(Boolean)

/**
 * Test or live, read from a key set: Razorpay's key id prefix (also the OAuth
 * `public_token`), else a `mode` field (Cashfree, Decentro: anything but
 * 'live' runs on the sandbox), else Razorpay OAuth's `oauthMode`. Null when the
 * set is empty or says nothing; callers treat unknown as live, so a real order
 * is never hidden as a test.
 */
export function keySetMode(cfg: Record<string, string> | undefined): PaymentMode | null {
  if (!hasValues(cfg)) return null
  const keyId = cfg.keyId ?? ''
  if (keyId.startsWith('rzp_test_')) return 'test'
  if (keyId.startsWith('rzp_live_')) return 'live'
  if (cfg.mode !== undefined && cfg.mode !== '') return cfg.mode === 'live' ? 'live' : 'test'
  if (cfg.oauthMode === 'test' || cfg.oauthMode === 'live') return cfg.oauthMode
  if (cfg.appId || cfg.clientId) return 'test'
  return null
}

export type GatewayKeySets = {
  /** The mode checkout runs in now; null when no key set is in use yet. */
  active: PaymentMode | null
  test: Record<string, string> | undefined
  live: Record<string, string> | undefined
}

/** Both key sets of a gateway, each in its slot, and which one checkout uses. */
export function gatewayKeySets(providers: Providers, id: string): GatewayKeySets {
  const current = hasValues(providers[id]) ? providers[id] : undefined
  const active = current ? (keySetMode(current) ?? 'live') : null
  const slot = (mode: PaymentMode) => {
    if (active === mode) return current
    const parked = providers[parkedKey(id, mode)]
    return hasValues(parked) ? parked : undefined
  }
  return { active, test: slot('test'), live: slot('live') }
}

/**
 * Save one key set. It becomes the set in use when the gateway has none yet
 * or is already in that mode; otherwise it waits for the switch.
 */
export function withKeySet(
  providers: Providers,
  id: string,
  mode: PaymentMode,
  cfg: Record<string, string>,
): { providers: Providers; inUse: boolean } {
  const { active } = gatewayKeySets(providers, id)
  const next = { ...providers }
  if (active === null || active === mode) {
    next[id] = cfg
    delete next[parkedKey(id, mode)]
    return { providers: next, inUse: true }
  }
  next[parkedKey(id, mode)] = cfg
  return { providers: next, inUse: false }
}

/**
 * Flip a gateway to `to`: the waiting set becomes the one in use and the set
 * in use waits. Nothing is deleted. Refused when there is no set for `to`.
 */
export function switchKeySet(
  providers: Providers,
  id: string,
  to: PaymentMode,
): { ok: true; providers: Providers } | { ok: false; reason: 'no_keys' } {
  const sets = gatewayKeySets(providers, id)
  if (sets.active === to) return { ok: true, providers }
  const incoming = sets[to]
  if (!incoming) return { ok: false, reason: 'no_keys' }
  const next = { ...providers, [id]: incoming }
  delete next[parkedKey(id, to)]
  const outgoing = providers[id]
  if (hasValues(outgoing)) next[parkedKey(id, otherMode(to))] = outgoing
  return { ok: true, providers: next }
}

/**
 * A whole-blob save (the generic Connect page, `store.updatePayments`) that
 * replaces a gateway's set in use with keys of the other mode keeps the
 * replaced set waiting instead of dropping it, so no save ever loses a key set.
 */
export function keepReplacedKeySets(before: Providers, after: Providers): Providers {
  const next = { ...after }
  for (const id of MODE_GATEWAY_IDS) {
    const was = before[id]
    const wasMode = hasValues(was) ? keySetMode(was) : null
    const nowMode = hasValues(after[id]) ? keySetMode(after[id]) : null
    if (!was || !wasMode || !nowMode || wasMode === nowMode) continue
    if (!hasValues(next[parkedKey(id, wasMode)])) next[parkedKey(id, wasMode)] = was
    delete next[parkedKey(id, nowMode)]
  }
  return next
}

type ActivationSource = {
  enabled: string[]
  inactive?: Record<string, string[]> | undefined
  methods?: CheckoutMethod[] | undefined
}

/** True when the merchant switched this gateway off (its keys are kept). */
export const isGatewayInactive = (s: Pick<ActivationSource, 'inactive'>, id: string): boolean =>
  !!s.inactive && Object.hasOwn(s.inactive, id)

/**
 * Switch a gateway off: its providers (`family`: the gateway and any method on
 * its keys, such as Razorpay UPI QR) leave checkout at once. Which of them were
 * on is remembered so switching it on again restores them. Keys stay.
 */
export function deactivateGateway<S extends ActivationSource>(
  s: S,
  id: string,
  family: string[],
): S & Required<Pick<ActivationSource, 'inactive'>> {
  const members = new Set([id, ...family])
  const wasOn = s.enabled.filter((x) => members.has(x))
  return {
    ...s,
    enabled: s.enabled.filter((x) => !members.has(x)),
    inactive: { ...(s.inactive ?? {}), [id]: wasOn.length ? wasOn : [id] },
  }
}

/**
 * Switch a gateway back on, restoring the providers it had on. A main gateway
 * (Razorpay, Cashfree) takes the online methods again, so the other main
 * gateway is switched off (keys kept), as connecting one always did.
 */
export function activateGateway<S extends ActivationSource>(
  s: S,
  id: string,
  methods: CheckoutMethod[],
): S & Required<Pick<ActivationSource, 'inactive'>> {
  const restore = s.inactive?.[id] ?? [id]
  const inactive = { ...(s.inactive ?? {}) }
  delete inactive[id]
  if (!isGatewayProvider(id)) {
    const extra = restore.filter((x) => !s.enabled.includes(x))
    return { ...s, enabled: [...s.enabled, ...extra], inactive }
  }
  for (const other of s.enabled) {
    if (isGatewayProvider(other) && other !== id) inactive[other] = [other]
  }
  const kept = s.enabled.filter((x) => !isGatewayProvider(x) || x === id)
  const extra = restore.filter((x) => x !== id && !kept.includes(x))
  return { ...s, enabled: enabledForMethods([...kept, ...extra], methods, id), inactive }
}

/** True when a gateway on at checkout runs on its test keys: shoppers' payments are not real. */
export function checkoutTestMode(s: ActivationSource & { providers: Providers }): boolean {
  return MODE_GATEWAY_IDS.some(
    (id) =>
      s.enabled.includes(id) &&
      !isGatewayInactive(s, id) &&
      gatewayKeySets(s.providers, id).active === 'test',
  )
}
