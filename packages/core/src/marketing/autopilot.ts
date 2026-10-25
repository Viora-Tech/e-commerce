/** SOURCE OF TRUTH: Campaign Autopilot rules — WHAT: the merchant's Autopilot settings (goals, weekly message and campaign caps, the largest discount it may offer), the proposals it keeps in `store.preferences.growthAutopilot`, the festival calendar and the planner that turns store numbers into proposed campaigns / WHY: pure, so the plan can be tested on plain numbers and the admin form validates with the same schema; nothing here sends anything, every proposal waits for the merchant's approval */
import { dayKey, dayStart } from '@commerce/dates'
import { z } from 'zod'
import type { AutomationState } from './recommendations'

export const AUTOPILOT_GOALS = ['recover_carts', 'new_products', 'win_back', 'festive'] as const
export type AutopilotGoal = (typeof AUTOPILOT_GOALS)[number]

export const AUTOPILOT_LIMITS = {
  maxMessagesPerWeek: 1_000_000,
  maxCampaignsPerWeek: 7,
  maxDiscountPercent: 50,
  proposals: 30,
} as const

export const AutopilotSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  goals: z
    .array(z.enum(AUTOPILOT_GOALS))
    .max(AUTOPILOT_GOALS.length)
    .default(['recover_carts', 'new_products', 'win_back', 'festive']),
  /** The most marketing emails Autopilot may plan in any seven days. */
  maxMessagesPerWeek: z
    .number()
    .int()
    .min(0)
    .max(AUTOPILOT_LIMITS.maxMessagesPerWeek)
    .default(2000),
  /** The most campaigns Autopilot may plan in any seven days. */
  maxCampaignsPerWeek: z.number().int().min(1).max(AUTOPILOT_LIMITS.maxCampaignsPerWeek).default(2),
  /** 0 means Autopilot never offers a discount. */
  maxDiscountPercent: z.number().int().min(0).max(AUTOPILOT_LIMITS.maxDiscountPercent).default(10),
})
export type AutopilotSettings = z.infer<typeof AutopilotSettingsSchema>

const AUTOPILOT_PROPOSAL_STATUSES = ['proposed', 'scheduled', 'dismissed'] as const
export type AutopilotProposalStatus = (typeof AUTOPILOT_PROPOSAL_STATUSES)[number]

const AutopilotProposalSchema = z.object({
  id: z.string().min(1).max(40),
  goal: z.enum(AUTOPILOT_GOALS),
  /** A draft email campaign, or switching on the abandoned-checkout automation. */
  kind: z.enum(['campaign', 'automation']),
  /** The draft campaign Autopilot wrote; null for the automation proposal. */
  campaignId: z.uuid().nullable(),
  /** The festival a festive campaign is for. */
  festival: z.string().max(40).nullable().default(null),
  /** When the campaign should go out, ISO. */
  sendAt: z.iso.datetime({ offset: true }),
  /** Customers it would reach when it was planned. */
  audience: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(AUTOPILOT_LIMITS.maxDiscountPercent),
  /** The figures the reason line quotes. */
  numbers: z.record(z.string(), z.number()).default({}),
  /** True when the AI writer wrote the message; false for the built-in template. */
  aiWritten: z.boolean().default(false),
  status: z.enum(AUTOPILOT_PROPOSAL_STATUSES).default('proposed'),
  createdAt: z.iso.datetime({ offset: true }),
})
export type AutopilotProposal = z.infer<typeof AutopilotProposalSchema>

export const AutopilotStateSchema = z.object({
  settings: AutopilotSettingsSchema.prefault({}),
  proposals: z.array(AutopilotProposalSchema).max(AUTOPILOT_LIMITS.proposals).default([]),
  plannedAt: z.iso.datetime({ offset: true }).nullable().default(null),
})
export type AutopilotState = z.infer<typeof AutopilotStateSchema>

const defaultAutopilotState: AutopilotState = AutopilotStateSchema.parse({})

/** The Autopilot state stored in `store.preferences`, defaults for anything missing or invalid. */
export function parseAutopilotState(preferences: unknown): AutopilotState {
  const raw =
    preferences && typeof preferences === 'object'
      ? (preferences as Record<string, unknown>).growthAutopilot
      : undefined
  const r = AutopilotStateSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultAutopilotState
}

/** Sale days Indian shoppers plan around. Festive campaigns go out a few days before. */
export const FESTIVALS = [
  { id: 'dhanteras-2026', name: 'Dhanteras', date: '2026-11-06' },
  { id: 'diwali-2026', name: 'Diwali', date: '2026-11-08' },
  { id: 'black-friday-2026', name: 'Black Friday', date: '2026-11-27' },
  { id: 'christmas-2026', name: 'Christmas', date: '2026-12-25' },
  { id: 'new-year-2027', name: 'New Year', date: '2027-01-01' },
  { id: 'republic-day-2027', name: 'Republic Day', date: '2027-01-26' },
  { id: 'valentines-2027', name: "Valentine's Day", date: '2027-02-14' },
  { id: 'holi-2027', name: 'Holi', date: '2027-03-22' },
  { id: 'independence-day-2027', name: 'Independence Day', date: '2027-08-15' },
  { id: 'raksha-bandhan-2027', name: 'Raksha Bandhan', date: '2027-08-17' },
  { id: 'navratri-2027', name: 'Navratri', date: '2027-09-30' },
  { id: 'dussehra-2027', name: 'Dussehra', date: '2027-10-09' },
  { id: 'diwali-2027', name: 'Diwali', date: '2027-10-29' },
] as const
export type Festival = (typeof FESTIVALS)[number]

const DAY_MS = 86_400_000
/** Campaigns go out at 10:00 IST. */
const SEND_HOUR_IST = 10
/** A festival this close gets a campaign. */
const FESTIVAL_LOOKAHEAD_DAYS = 21
/** Festive campaigns go out this many days before the day. */
const FESTIVAL_LEAD_DAYS = 3
/** Days between two planned campaigns, so customers are not sent two in a row. */
const SPACING_DAYS = 2
const MIN_LAPSED = 5
const MIN_SUBSCRIBERS = 10
const GOAL_DISCOUNT: Record<AutopilotGoal, number> = {
  recover_carts: 0,
  new_products: 0,
  win_back: 15,
  festive: 10,
}

/** The ISO date (IST) of an instant. */
const istDate = (at: Date): string => dayKey(at)

/** 10:00 IST on an ISO date. */
const sendTimeOn = (isoDate: string): Date =>
  new Date(dayStart(isoDate).getTime() + SEND_HOUR_IST * 3_600_000)

/** The next festival between tomorrow and the lookahead, or null. */
function upcomingFestival(now: Date): Festival | null {
  const today = istDate(now)
  const until = istDate(new Date(now.getTime() + FESTIVAL_LOOKAHEAD_DAYS * DAY_MS))
  return FESTIVALS.find((f) => f.date > today && f.date <= until) ?? null
}

/** Store numbers the planner reads, gathered by the API. */
export type AutopilotFacts = {
  now: Date
  /** Customers who accept email marketing and have not unsubscribed. */
  subscribers: number
  /** Subscribed customers with no order in 90 days. */
  lapsedCustomers: number
  abandoned: { carts: number; valuePaise: number }
  cartAutomation: AutomationState
  /** Active products published in the last 14 days, newest first. */
  newProducts: number
  /** Marketing campaigns already scheduled or sent in the last seven days. */
  campaignsThisWeek: number
  /** Recipients of those campaigns. */
  messagesThisWeek: number
}

/** One thing the planner wants to propose; the API writes the campaign and stores it. */
export type PlannedItem = {
  goal: AutopilotGoal
  kind: 'campaign' | 'automation'
  festival: Festival | null
  sendAt: Date
  audience: number
  discountPercent: number
  numbers: Record<string, number>
}

/**
 * What Autopilot proposes next: one item per chosen goal whose numbers call for it and that
 * has no proposal waiting already, within the weekly campaign and message caps, spaced a
 * couple of days apart. Never sends; every item waits for the merchant.
 */
export function planAutopilot(
  facts: AutopilotFacts,
  settings: AutopilotSettings,
  existing: AutopilotProposal[],
): PlannedItem[] {
  if (!settings.enabled) return []
  const waiting = new Set(existing.filter((p) => p.status === 'proposed').map((p) => p.goal))
  const pendingCampaigns = existing.filter((p) => p.status === 'proposed' && p.kind === 'campaign')
  let campaignsLeft =
    settings.maxCampaignsPerWeek - facts.campaignsThisWeek - pendingCampaigns.length
  let messagesLeft =
    settings.maxMessagesPerWeek -
    facts.messagesThisWeek -
    pendingCampaigns.reduce((n, p) => n + p.audience, 0)
  const discount = (goal: AutopilotGoal) =>
    Math.min(GOAL_DISCOUNT[goal], settings.maxDiscountPercent)
  const out: PlannedItem[] = []
  let slot = 1

  const wants = (goal: AutopilotGoal) => settings.goals.includes(goal) && !waiting.has(goal)
  const nextSlot = () => {
    const at = sendTimeOn(istDate(new Date(facts.now.getTime() + slot * DAY_MS)))
    slot += SPACING_DAYS
    return at
  }
  const addCampaign = (item: Omit<PlannedItem, 'kind' | 'sendAt'> & { sendAt?: Date }) => {
    if (campaignsLeft <= 0 || item.audience <= 0 || item.audience > messagesLeft) return
    campaignsLeft -= 1
    messagesLeft -= item.audience
    out.push({ ...item, kind: 'campaign', sendAt: item.sendAt ?? nextSlot() })
  }

  if (
    wants('recover_carts') &&
    facts.cartAutomation.status !== 'active' &&
    facts.abandoned.carts > 0
  ) {
    out.push({
      goal: 'recover_carts',
      kind: 'automation',
      festival: null,
      sendAt: facts.now,
      audience: facts.abandoned.carts,
      discountPercent: 0,
      numbers: { carts: facts.abandoned.carts, valuePaise: facts.abandoned.valuePaise },
    })
  }

  const festival = upcomingFestival(facts.now)
  if (
    wants('festive') &&
    festival &&
    facts.subscribers >= MIN_SUBSCRIBERS &&
    !existing.some((p) => p.festival === festival.id && p.status !== 'dismissed')
  ) {
    const lead = sendTimeOn(
      istDate(new Date(Date.parse(`${festival.date}T00:00:00Z`) - FESTIVAL_LEAD_DAYS * DAY_MS)),
    )
    const earliest = sendTimeOn(istDate(new Date(facts.now.getTime() + DAY_MS)))
    addCampaign({
      goal: 'festive',
      festival,
      sendAt: lead > earliest ? lead : earliest,
      audience: facts.subscribers,
      discountPercent: discount('festive'),
      numbers: { subscribers: facts.subscribers },
    })
  }

  if (wants('new_products') && facts.newProducts > 0 && facts.subscribers >= MIN_SUBSCRIBERS) {
    addCampaign({
      goal: 'new_products',
      festival: null,
      audience: facts.subscribers,
      discountPercent: discount('new_products'),
      numbers: { products: facts.newProducts, subscribers: facts.subscribers },
    })
  }

  if (wants('win_back') && facts.lapsedCustomers >= MIN_LAPSED) {
    addCampaign({
      goal: 'win_back',
      festival: null,
      audience: facts.lapsedCustomers,
      discountPercent: discount('win_back'),
      numbers: { customers: facts.lapsedCustomers },
    })
  }

  return out
}

/** Proposals still on screen: waiting first (soonest send), then the rest newest first. */
export function visibleProposals(proposals: AutopilotProposal[]): AutopilotProposal[] {
  const waiting = proposals
    .filter((p) => p.status === 'proposed')
    .sort((a, b) => a.sendAt.localeCompare(b.sendAt))
  const done = proposals
    .filter((p) => p.status !== 'proposed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return [...waiting, ...done]
}

/** Keeps the newest proposals within the stored limit, never dropping one still waiting. */
export function trimProposals(proposals: AutopilotProposal[]): AutopilotProposal[] {
  const waiting = proposals.filter((p) => p.status === 'proposed')
  const done = proposals
    .filter((p) => p.status !== 'proposed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return [...waiting, ...done].slice(0, AUTOPILOT_LIMITS.proposals)
}

/** The campaign name Autopilot gives a draft, e.g. "Autopilot · Win back · 24 Oct". */
export function autopilotCampaignName(item: Pick<PlannedItem, 'goal' | 'festival' | 'sendAt'>) {
  const label: Record<AutopilotGoal, string> = {
    recover_carts: 'Cart recovery',
    new_products: 'New arrivals',
    win_back: 'Win back',
    festive: item.festival ? `${item.festival.name} sale` : 'Festive sale',
  }
  const day = istDate(item.sendAt).slice(5, 10)
  return `Autopilot · ${label[item.goal]} · ${day}`
}

/** The message Autopilot falls back to when the AI writer is off or fails. */
export type AutopilotMessage = {
  subject: string
  previewText: string
  heading: string
  body: string
  button: string
}

export function templateMessage(input: {
  goal: AutopilotGoal
  storeName: string
  festival: string | null
  discountPercent: number
  productTitles: string[]
}): AutopilotMessage {
  const offer =
    input.discountPercent > 0 ? ` Use the code below for ${input.discountPercent}% off.` : ''
  const store = input.storeName || 'our store'
  switch (input.goal) {
    case 'festive': {
      const day = input.festival ?? 'the festive season'
      return {
        subject: `${day} picks from ${store}`,
        previewText: `Gifts and treats for ${day}, ready to ship.`,
        heading: `Get ready for ${day}`,
        body: `Our ${day} favourites are in. Order early so everything arrives in time.${offer}`,
        button: 'Shop now',
      }
    }
    case 'new_products': {
      const named = input.productTitles.slice(0, 2).join(' and ')
      return {
        subject: named ? `New at ${store}: ${named}` : `New arrivals at ${store}`,
        previewText: 'Fresh picks just landed in the store.',
        heading: 'Just arrived',
        body: `We have added new products we think you will like. Take a look before they sell out.${offer}`,
        button: 'See what is new',
      }
    }
    case 'win_back':
      return {
        subject: `We miss you at ${store}`,
        previewText: 'A lot has changed since your last order.',
        heading: 'It has been a while',
        body: `Come back and see what is new since your last order.${offer}`,
        button: 'Come back and shop',
      }
    case 'recover_carts':
      return {
        subject: 'You left something in your cart',
        previewText: 'Your cart is saved and waiting.',
        heading: 'Still thinking it over?',
        body: 'Your cart is saved. Finish your order whenever you are ready.',
        button: 'Return to cart',
      }
  }
}

/** A discount code for a proposal: `WINBACK15-7Q2K`, unique enough per store. */
export function autopilotDiscountCode(goal: AutopilotGoal, percent: number, salt: string): string {
  const stem: Record<AutopilotGoal, string> = {
    recover_carts: 'CART',
    new_products: 'NEW',
    win_back: 'WINBACK',
    festive: 'FESTIVE',
  }
  const tail =
    salt
      .replace(/[^a-z0-9]/gi, '')
      .slice(-4)
      .toUpperCase() || '0000'
  return `${stem[goal]}${percent}-${tail}`
}
