/** SOURCE OF TRUTH: customer privacy settings, data request rules, marketing consent channels — WHAT: Settings → Customer privacy (cookie banner text and version, how many days a data request may take) stored on `store.preferences.customerPrivacy`, the data request kinds, statuses and due dates, and which customer flag holds consent for each marketing channel / WHY: the admin queue, the storefront account page, the banner and every marketing send must agree on these, and client code needs them without a database import */
import { z } from 'zod'

/*
 * Pure: no database import, so admin and storefront client components can use
 * it through `@commerce/core/privacy`.
 */

export const PRIVACY_LIMITS = {
  bannerMessage: 500,
  /** The fewest and most days a merchant can give themselves to answer a data request. */
  minDueDays: 7,
  maxDueDays: 90,
  note: 2000,
  resolution: 2000,
} as const

/** 30 days: the window most privacy laws settle on, and well inside what the DPDP Rules allow. */
export const DEFAULT_REQUEST_DUE_DAYS = 30

export const CustomerPrivacySettingsSchema = z.object({
  /** Replaces the default cookie banner text when set. */
  bannerMessage: z.string().trim().max(PRIVACY_LIMITS.bannerMessage).default(''),
  /** Bumped by "Ask everyone again": choices made for an older banner stop counting. */
  bannerVersion: z.number().int().min(1).default(1),
  /** Days the store gives itself to answer a data request; sets each request's due date. */
  requestDueDays: z
    .number()
    .int()
    .min(PRIVACY_LIMITS.minDueDays)
    .max(PRIVACY_LIMITS.maxDueDays)
    .default(DEFAULT_REQUEST_DUE_DAYS),
})
export type CustomerPrivacySettings = z.infer<typeof CustomerPrivacySettingsSchema>

export const defaultCustomerPrivacySettings: CustomerPrivacySettings =
  CustomerPrivacySettingsSchema.parse({})

/**
 * The `customerPrivacy` key of `store.preferences`, with defaults for anything
 * missing or invalid. Stores that set a banner message in Online Store →
 * Preferences before this page existed keep it (`preferences.privacy.message`).
 */
export function parseCustomerPrivacySettings(preferences: unknown): CustomerPrivacySettings {
  const prefs = preferences && typeof preferences === 'object' ? preferences : {}
  const raw = (prefs as { customerPrivacy?: unknown }).customerPrivacy
  if (raw === undefined) {
    const legacy = (prefs as { privacy?: { message?: unknown } }).privacy?.message
    const r = CustomerPrivacySettingsSchema.safeParse({
      bannerMessage: typeof legacy === 'string' ? legacy : '',
    })
    return r.success ? r.data : defaultCustomerPrivacySettings
  }
  const r = CustomerPrivacySettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultCustomerPrivacySettings
}

// Data requests -------------------------------------------------------------

export const DATA_REQUEST_KINDS = ['export', 'delete'] as const
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number]

export const DATA_REQUEST_STATUSES = ['open', 'in_progress', 'completed', 'rejected'] as const
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number]

/** Where the ask came from: the shopper's account page, or staff logging an email or call. */
export const DATA_REQUEST_SOURCES = ['account', 'email', 'phone', 'other'] as const
export type DataRequestSource = (typeof DATA_REQUEST_SOURCES)[number]

/** Sources staff can pick when logging a request by hand. */
export const STAFF_REQUEST_SOURCES = [
  'email',
  'phone',
  'other',
] as const satisfies readonly DataRequestSource[]

export function isOpenStatus(status: DataRequestStatus): boolean {
  return status === 'open' || status === 'in_progress'
}

/** Which statuses a request can move to from here. Closed requests stay closed. */
export function nextStatuses(status: DataRequestStatus): DataRequestStatus[] {
  if (status === 'open') return ['in_progress', 'completed', 'rejected']
  if (status === 'in_progress') return ['open', 'completed', 'rejected']
  return []
}

const DAY_MS = 24 * 60 * 60 * 1000

/** When a request made at `from` must be answered by. */
export function requestDueAt(from: Date, dueDays: number): Date {
  return new Date(from.getTime() + dueDays * DAY_MS)
}

export type RequestUrgency = 'overdue' | 'due_soon' | 'on_track' | 'closed'

/** Due within this many days reads as "due soon" in the queue. */
export const DUE_SOON_DAYS = 5

export function requestUrgency(
  request: { status: DataRequestStatus; dueAt: Date },
  now: Date,
): RequestUrgency {
  if (!isOpenStatus(request.status)) return 'closed'
  const left = request.dueAt.getTime() - now.getTime()
  if (left < 0) return 'overdue'
  if (left <= DUE_SOON_DAYS * DAY_MS) return 'due_soon'
  return 'on_track'
}

/** Whole days until the due date; negative once it has passed. */
export function daysUntilDue(dueAt: Date, now: Date): number {
  return Math.ceil((dueAt.getTime() - now.getTime()) / DAY_MS)
}

/** A customer's data as JSON (complete, for machines) or CSV (opens in a spreadsheet). */
export const EXPORT_FORMATS = ['json', 'csv'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

// Marketing consent ---------------------------------------------------------

export const CONSENT_CHANNELS = ['email', 'whatsapp', 'sms'] as const
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number]

/** The customer flags that hold consent right now, per channel. */
export type ConsentFlags = {
  acceptsMarketing: boolean
  acceptsWhatsapp: boolean
  acceptsSms: boolean
  unsubscribedAt: Date | null
  anonymisedAt?: Date | null | undefined
}

export const CONSENT_FLAG: Record<ConsentChannel, keyof ConsentFlags> = {
  email: 'acceptsMarketing',
  whatsapp: 'acceptsWhatsapp',
  sms: 'acceptsSms',
}

/**
 * Whether a customer may get marketing on a channel. Only an explicit yes on
 * that channel counts; the unsubscribe link and erasure turn everything off.
 */
export function hasMarketingConsent(
  flags: ConsentFlags | null | undefined,
  channel: ConsentChannel,
): boolean {
  if (!flags || flags.unsubscribedAt || flags.anonymisedAt) return false
  return flags[CONSENT_FLAG[channel]] === true
}
