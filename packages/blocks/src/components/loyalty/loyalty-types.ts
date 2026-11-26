/** SOURCE OF TRUTH: the loyalty widget's data — WHAT: the JSON the storefront's `/api/loyalty/*` routes answer and the Points page hands its client parts (program, the shopper's points, tier, rewards, codes, ways to earn, referral) / WHY: the widget lives in `@commerce/blocks`, which cannot import `@commerce/core`; the storefront maps core's view onto these shapes (`apps/storefront/src/lib/loyalty-view.ts`) */

export type LoyaltyPointsName = { singular: string; plural: string }

/** A referral reward: points, a whole percent off, or paise off. */
export type LoyaltyOffer = { kind: 'points' | 'percent' | 'fixed'; value: number }

export type LoyaltyWayToEarn = {
  id: string
  /** `order_spend`, `signup`, `social`, `daily_visit`, ... (core's rule types). */
  type: string
  /** The platform for a `social` rule (`instagram`, `youtube`, ...), else ''. */
  key: string
  title: string | null
  points: number
  /** Social and Google review rules: the link the button opens. */
  url: string | null
  streakDays: number | null
  onceOnly: boolean
  /** Signed in: already earned (once-only rules). */
  claimed: boolean
}

export type LoyaltyRewardView = {
  id: string
  /** `amount_off`, `custom_amount_off`, `percent_off`, `free_product`, `free_shipping`, `store_credit`. */
  type: string
  title: string
  description: string | null
  pointsCost: number
  /** Paise for amount rewards, basis points for percent off. */
  value: number
  minPoints: number | null
  maxPoints: number | null
  productId: string | null
  minOrderPaise: number | null
  /** Signed in: why it cannot be taken now (`points`, `tier`, `sold_out`, ...), null when it can. */
  block: string | null
}

export type LoyaltyTierView = {
  id: string
  name: string
  threshold: number
  multiplierBp: number
  perks: string[]
  colors: { background: string; text: string } | null
}

export type LoyaltyCodeView = {
  id: string
  title: string
  code: string | null
  /** `issued`, `used`, `cancelled`, `expired`. */
  status: string
  rewardType: string
  expiresAt: string | null
  createdAt: string
}

export type LoyaltyMemberView = {
  points: number
  expiringSoon: { points: number; lastDay: string } | null
  pendingPoints: number
  tier: {
    /** `points` (points earned) or `spend` (paise spent). */
    basis: string
    value: number
    currentId: string | null
    nextId: string | null
    toNext: number
  }
  streakDays: number
  codes: LoyaltyCodeView[]
}

export type LoyaltyReferralView = {
  friendReward: LoyaltyOffer
  /** What the member gets for a referral (shown to visitors too, on the Give / Get card). */
  referrerReward: LoyaltyOffer | null
  /** The shopper's own link (absolute), signed in only. */
  url: string | null
  completed: number
  /** The share buttons the merchant chose (Loyalty → Referrals), in the program's order. */
  shareChannels: string[]
}

/** Everything the widget, the blocks and the Points page show. */
export type LoyaltyView = {
  storeName: string
  live: boolean
  signedIn: boolean
  /** In the program (signed in, not excluded). */
  open: boolean
  pointsName: LoyaltyPointsName
  pointsAsStoreCredit: boolean
  /** Paise one point is worth as store credit. */
  pointPaise: number
  waysToEarn: LoyaltyWayToEarn[]
  rewards: LoyaltyRewardView[]
  tiers: LoyaltyTierView[]
  referral: LoyaltyReferralView | null
  member: LoyaltyMemberView | null
  /** Asked for with `?cart=1`: the shopper's cart, for "Redeem in cart". */
  cart: { subtotalPaise: number; productIds: string[]; discountCode: string | null } | null
}

/** What a redeem answers: the code to use (null for store credit). */
export type LoyaltyRedeemed = {
  id: string
  title: string
  code: string | null
  expiresAt: string | null
  rewardType: string
}

/** The light read for points next to prices (`/api/loyalty/earn`). */
export type LoyaltyEarnInfo = {
  live: boolean
  signedIn: boolean
  open: boolean
  pointsName: LoyaltyPointsName
  /** The order spend rule's points per ₹100, 0 when off. */
  pointsPer100: number
  /** The shopper's tier multiplier (10000 = 1x). */
  multiplierBp: number
}
