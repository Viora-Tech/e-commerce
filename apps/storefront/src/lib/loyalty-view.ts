import 'server-only'
import type { LoyaltyEarnInfo, LoyaltyView } from '@commerce/blocks/loyalty'
import {
  canUseProgram,
  getCart,
  loyaltyState,
  POINT_PAISE,
  publicLoyaltyProgram,
  shopperLoyalty,
  tierProgress,
} from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { readCartId } from './cart-cookie'
import { customerIn } from './customer-session'
import { storeRead } from './store-cache'
import { inStore } from './store-context'

type Program = Awaited<ReturnType<typeof publicLoyaltyProgram>>
type Shopper = Extract<Awaited<ReturnType<typeof shopperLoyalty>>, { open: true }>

const ONE_X = 10_000
const PROGRAM_TTL_MS = 60_000

const iso = (d: Date | string | null) => (d === null ? null : new Date(d).toISOString())

async function storeNameOf(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return s?.name ?? ''
}

/** The store's name (cached), for the widget's "{Store} Rewards". */
export function storeNameFor(storeId: string): Promise<string> {
  return storeRead(storeId, 'store-name', (tx) => storeNameOf(tx, storeId))
}

/**
 * The signed-out program, the same for every visitor. Cached for a minute: the loyalty tables
 * have no storefront-cache trigger, so a rule or reward change shows within that minute.
 */
function cachedProgram(storeId: string) {
  return storeRead(
    storeId,
    'loyalty-program',
    async (tx) => {
      const state = await loyaltyState(tx, storeId)
      if (!state.installed) return null
      return {
        program: await publicLoyaltyProgram({ storeId, tx }, state.settings),
        storeName: await storeNameOf(tx, storeId),
        shareChannels: shareChannelsOf(state.settings.referrals),
      }
    },
    { ttlMs: PROGRAM_TTL_MS },
  )
}

function programPart(program: Program) {
  return {
    live: program.live,
    pointsName: program.pointsName,
    pointsAsStoreCredit: program.pointsAsStoreCredit,
    pointPaise: POINT_PAISE,
    tiers: program.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      threshold: t.threshold,
      multiplierBp: t.multiplierBp,
      perks: t.perks,
      colors: t.colors ?? null,
    })),
  }
}

/**
 * `referrals.shareChannels` (the admin's Referrals page), read defensively: a program saved
 * before the setting existed gets the settings default.
 */
function shareChannelsOf(referrals: unknown): string[] {
  const raw = (referrals as { shareChannels?: unknown } | null)?.shareChannels
  return Array.isArray(raw)
    ? raw.filter((c): c is string => typeof c === 'string')
    : ['whatsapp', 'email', 'x', 'facebook']
}

type Cached = { program: Program; storeName: string; shareChannels: string[] }

function guestView(cached: Cached, signedIn: boolean): LoyaltyView {
  const { program, storeName, shareChannels } = cached
  return {
    ...programPart(program),
    storeName,
    signedIn,
    open: false,
    waysToEarn: program.waysToEarn.map((w) => ({ ...w, claimed: false })),
    rewards: program.rewards.map((r) => ({ ...r, block: null })),
    referral: program.referral
      ? {
          friendReward: program.referral.friendReward,
          // What a member gets for a referral: the guest's Give / Get card shows it too.
          referrerReward: program.referral.referrerReward ?? null,
          url: null,
          completed: 0,
          shareChannels,
        }
      : null,
    member: null,
    cart: null,
  }
}

function memberView(s: Shopper, cached: Cached, origin: string): LoyaltyView {
  const { storeName, shareChannels } = cached
  return {
    ...programPart(s.program),
    storeName,
    signedIn: true,
    open: true,
    waysToEarn: s.waysToEarn,
    rewards: s.rewards.map((r) => ({ ...r, block: r.block ?? null })),
    referral: s.referral
      ? {
          friendReward: s.referral.friendReward,
          referrerReward: s.referral.referrerReward,
          url: `${origin}${s.referral.path}`,
          completed: s.referral.completed,
          shareChannels,
        }
      : null,
    member: {
      points: s.summary.points,
      expiringSoon: s.summary.expiringSoon,
      pendingPoints: s.summary.pendingPoints,
      tier: {
        basis: s.tier.basis,
        value: s.tier.value,
        currentId: s.tier.current?.id ?? null,
        nextId: s.tier.next?.id ?? null,
        toNext: s.tier.toNext,
      },
      streakDays: s.streakDays,
      codes: s.redemptions.map((r) => ({
        id: r.id,
        title: r.title,
        code: r.code,
        status: r.status,
        rewardType: r.rewardType,
        expiresAt: iso(r.expiresAt),
        createdAt: iso(r.createdAt) ?? '',
      })),
    },
    cart: null,
  }
}

/** The cart part of the view, for "Redeem in cart". */
async function cartPart(tx: StoreTx, storeId: string): Promise<LoyaltyView['cart']> {
  const cartId = await readCartId()
  const cart = cartId ? await getCart({ storeId, tx }, cartId) : null
  if (!cart || cart.lines.length === 0) return null
  return {
    subtotalPaise: cart.subtotalPaise,
    productIds: [...new Set(cart.lines.flatMap((l) => (l.productId ? [l.productId] : [])))],
    discountCode: cart.discountCode,
  }
}

/**
 * Everything the Loyalty widget, its blocks and the Points page show, for this request's
 * shopper (or the signed-out program). Null without the app. `origin` makes the referral link
 * absolute.
 */
export async function loyaltyViewFor(
  storeId: string,
  origin: string,
  opts: { cart?: boolean } = {},
): Promise<LoyaltyView | null> {
  const cached = await cachedProgram(storeId)
  if (!cached) return null
  return inStore(storeId, async (tx) => {
    const me = await customerIn(tx, storeId)
    let view = guestView(cached, Boolean(me))
    if (me) {
      const { settings } = await loyaltyState(tx, storeId)
      const s = await shopperLoyalty({ storeId, tx }, me.id, settings)
      if (s.open) view = memberView(s, cached, origin)
    }
    if (opts.cart) view.cart = await cartPart(tx, storeId)
    return view
  })
}

/** The earn rate and the shopper's tier multiplier, for points next to prices. */
export async function loyaltyEarnFor(storeId: string): Promise<LoyaltyEarnInfo | null> {
  const cached = await cachedProgram(storeId)
  if (!cached) return null
  const rule = cached.program.waysToEarn.find((w) => w.type === 'order_spend')
  const base: LoyaltyEarnInfo = {
    live: cached.program.live,
    signedIn: false,
    open: false,
    pointsName: cached.program.pointsName,
    pointsPer100: rule?.points ?? 0,
    multiplierBp: ONE_X,
  }
  return inStore(storeId, async (tx) => {
    const me = await customerIn(tx, storeId)
    if (!me) return base
    const { settings } = await loyaltyState(tx, storeId)
    if (!(await canUseProgram({ storeId, tx }, me.id, settings))) return { ...base, signedIn: true }
    const tier = await tierProgress({ storeId, tx }, me.id, settings)
    return {
      ...base,
      signedIn: true,
      open: true,
      multiplierBp: tier.current?.multiplierBp ?? ONE_X,
    }
  })
}
