/** SOURCE OF TRUTH: growth recommendations rules — WHAT: which Growth overview recommendations a store gets (abandoned-checkout, welcome, win-back and COD-confirmation automations, a campaign after a quiet month, links that get clicks but no orders), in priority order, minus the ones it dismissed (`store.preferences.growthRecommendations`) / WHY: the rules are pure so they can be tested on plain numbers; the API gathers the numbers and the admin words them */
import type { AutomationTemplateId } from './automation-steps'

export const RECOMMENDATION_IDS = [
  'abandoned_checkout',
  'cod_confirmation',
  'win_back',
  'welcome',
  'campaign',
  'links_no_orders',
] as const
export type RecommendationId = (typeof RECOMMENDATION_IDS)[number]

/** An automation for one trigger: missing, paused or on. */
export type AutomationState = { status: 'missing' } | { status: 'paused' | 'active'; id: string }

/** Store numbers the rules read, gathered by the API. */
export type GrowthFacts = {
  automations: Record<
    'abandoned_checkout' | 'welcome_subscriber' | 'win_back' | 'cod_confirmation',
    AutomationState
  >
  /** Abandoned checkouts in the last 7 days not recovered yet, and their value. */
  abandoned: { carts: number; valuePaise: number }
  /** Customers who gave email consent in the last 30 days, and the 30 days before. */
  newSubscribers: { last30: number; previous30: number }
  /** Subscribed customers whose last order was more than the win-back window ago. */
  lapsedCustomers: number
  /** Orders in the last 30 days, and how many were cash on delivery. */
  orders30: { total: number; cod: number }
  /** Days since the last campaign finished sending; null when none ever did. */
  daysSinceCampaign: number | null
  /** A campaign is scheduled or sending right now. */
  campaignPending: boolean
  /** Customers who accept email marketing and have not unsubscribed. */
  subscribers: number
  /** Short links with clicks in the last 30 days and no orders ever, most clicked first. */
  quietLinks: { id: string; name: string; clicks: number }[]
}

export type RecommendationAction =
  | { kind: 'create_automation'; template: AutomationTemplateId }
  | { kind: 'open'; href: string }

export type GrowthRecommendation = {
  id: RecommendationId
  /** The figures the reason line quotes; the admin's copy formats them. */
  numbers: Record<string, number>
  /** A name the reason line quotes (the quiet link's), when there is one. */
  name?: string
  action: RecommendationAction
}

export const MAX_RECOMMENDATIONS = 3
/** COD at or above this share of 30-day orders (with enough orders) makes confirmations worth it. */
const COD_SHARE_THRESHOLD = 0.4
const COD_MIN_ORDERS = 10
const LAPSED_MIN_CUSTOMERS = 5
const QUIET_CAMPAIGN_DAYS = 30
const CAMPAIGN_MIN_SUBSCRIBERS = 10
const QUIET_LINK_MIN_CLICKS = 20

/** Create it from the template when missing; open it when it exists but is paused. */
function automationAction(
  state: AutomationState,
  template: AutomationTemplateId,
): RecommendationAction {
  return state.status === 'missing'
    ? { kind: 'create_automation', template }
    : { kind: 'open', href: `/growth/automations/${state.id}` }
}

const off = (state: AutomationState) => state.status !== 'active'

/** Every rule that fires, in priority order (money waiting first). */
export function growthRecommendations(facts: GrowthFacts): GrowthRecommendation[] {
  const out: GrowthRecommendation[] = []
  const a = facts.automations
  if (off(a.abandoned_checkout) && facts.abandoned.carts > 0) {
    out.push({
      id: 'abandoned_checkout',
      numbers: { carts: facts.abandoned.carts, valuePaise: facts.abandoned.valuePaise },
      action: automationAction(a.abandoned_checkout, 'abandoned_checkout'),
    })
  }
  const { total, cod } = facts.orders30
  if (off(a.cod_confirmation) && total >= COD_MIN_ORDERS && cod / total >= COD_SHARE_THRESHOLD) {
    out.push({
      id: 'cod_confirmation',
      numbers: { cod, total, share: cod / total },
      action: automationAction(a.cod_confirmation, 'cod_confirmation'),
    })
  }
  if (off(a.win_back) && facts.lapsedCustomers >= LAPSED_MIN_CUSTOMERS) {
    out.push({
      id: 'win_back',
      numbers: { customers: facts.lapsedCustomers },
      action: automationAction(a.win_back, 'win_back'),
    })
  }
  const subs = facts.newSubscribers
  if (off(a.welcome_subscriber) && subs.last30 > 0 && subs.last30 >= subs.previous30) {
    out.push({
      id: 'welcome',
      numbers: { last30: subs.last30, previous30: subs.previous30 },
      action: automationAction(a.welcome_subscriber, 'welcome_subscriber'),
    })
  }
  const quiet = facts.daysSinceCampaign === null || facts.daysSinceCampaign >= QUIET_CAMPAIGN_DAYS
  if (quiet && !facts.campaignPending && facts.subscribers >= CAMPAIGN_MIN_SUBSCRIBERS) {
    out.push({
      id: 'campaign',
      numbers: { subscribers: facts.subscribers, days: facts.daysSinceCampaign ?? -1 },
      action: { kind: 'open', href: '/growth/campaigns/new' },
    })
  }
  const link = facts.quietLinks.find((l) => l.clicks >= QUIET_LINK_MIN_CLICKS)
  if (link) {
    out.push({
      id: 'links_no_orders',
      numbers: { clicks: link.clicks, links: facts.quietLinks.length },
      name: link.name,
      action: { kind: 'open', href: '/growth/links' },
    })
  }
  return out
}

/** The first `max` recommendations the store has not dismissed. */
export function visibleRecommendations(
  all: GrowthRecommendation[],
  dismissed: ReadonlySet<string>,
  max = MAX_RECOMMENDATIONS,
): GrowthRecommendation[] {
  return all.filter((r) => !dismissed.has(r.id)).slice(0, max)
}

/** `store.preferences.growthRecommendations`: dismissed rule id → when (ISO). */
export type GrowthRecommendationPrefs = { dismissed: Record<string, string> }

export function parseGrowthRecommendationPrefs(preferences: unknown): GrowthRecommendationPrefs {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as Record<string, unknown>).growthRecommendations
      : null
  const dismissed =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>).dismissed : null
  if (!dismissed || typeof dismissed !== 'object') return { dismissed: {} }
  return {
    dismissed: Object.fromEntries(
      Object.entries(dismissed as Record<string, unknown>).filter(
        (e): e is [string, string] =>
          (RECOMMENDATION_IDS as readonly string[]).includes(e[0]) && typeof e[1] === 'string',
      ),
    ),
  }
}
