/** SOURCE OF TRUTH: InboxSettingsSchema, parseInboxSettings, isInboxAvailable — WHAT: the Inbox app's settings (greeting, away message, availability and weekly hours, contact capture, require sign-in, email fallback, retention, and the widget's look), kept in `store.apps.settings.inbox` with no table, and whether staff are "online" now in the store's time zone / WHY: the widget's away line, the contact-capture rule and the email fallback all hang on one reading of these. Pure. */
import { wallClock } from '@commerce/dates'
import { z } from 'zod'
import { InboxWidgetSchema, parseInboxWidget } from './widget'

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'A time like 09:30')

export const InboxDayHoursSchema = z.object({
  /** 0 = Sunday … 6 = Saturday. */
  day: z.number().int().min(0).max(6),
  open: z.boolean(),
  from: Time,
  to: Time,
})
export type InboxDayHours = z.infer<typeof InboxDayHoursSchema>

/** Monday to Saturday, 10 am to 7 pm; Sunday closed. */
export const DEFAULT_INBOX_HOURS: InboxDayHours[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: day !== 0,
  from: '10:00',
  to: '19:00',
}))

export const INBOX_AVAILABILITY = ['always', 'hours', 'offline'] as const
export const INBOX_CONTACT_CAPTURE = ['off', 'optional', 'required_when_away'] as const

export const InboxSettingsSchema = z.object({
  /** Blank shows the widget's own greeting in the shopper's language. */
  greeting: z.string().trim().max(300).default(''),
  /** Blank shows the widget's own away line. */
  awayMessage: z.string().trim().max(300).default(''),
  availability: z.enum(INBOX_AVAILABILITY).default('always'),
  hours: z.array(InboxDayHoursSchema).max(7).default(DEFAULT_INBOX_HOURS),
  contactCapture: z.enum(INBOX_CONTACT_CAPTURE).default('optional'),
  /** Off by default (owner, 2026-10-24): guests may chat. */
  requireSignIn: z.boolean().default(false),
  sound: z.boolean().default(true),
  /** Minutes without a staff reply before the shopper is emailed; 0 turns it off. */
  emailFallbackMinutes: z.number().int().min(0).max(240).default(10),
  /** Conversations whose last message is older than this are deleted. */
  retentionMonths: z.number().int().min(3).max(60).default(24),
  /** The chat button and card's look: the theme editor's Inbox app embed (`widget.ts`). */
  widget: z.preprocess((v) => parseInboxWidget(v), InboxWidgetSchema),
})
export type InboxSettings = z.infer<typeof InboxSettingsSchema>

export const InboxSettingsPatchSchema = InboxSettingsSchema.partial()
export type InboxSettingsPatch = z.infer<typeof InboxSettingsPatchSchema>

export const DEFAULT_INBOX_SETTINGS: InboxSettings = InboxSettingsSchema.parse({})

/** Whatever is stored (or nothing) as full settings; a broken field falls back on its own. */
export function parseInboxSettings(raw: unknown): InboxSettings {
  const whole = InboxSettingsSchema.safeParse(raw ?? {})
  if (whole.success) return whole.data
  const out: Record<string, unknown> = { ...DEFAULT_INBOX_SETTINGS }
  if (raw && typeof raw === 'object') {
    const shape = InboxSettingsSchema.shape
    for (const [key, value] of Object.entries(raw)) {
      const field = shape[key as keyof typeof shape]
      const parsed = field?.safeParse(value)
      if (parsed?.success) out[key] = parsed.data
    }
  }
  return out as InboxSettings
}

/** Weekday (0 = Sunday) and minutes since midnight at `now` in `timeZone`. */
export function zonedWeekMinute(now: Date, timeZone: string): { day: number; minute: number } {
  const wall = wallClock(now, timeZone)
  return { day: wall.getUTCDay(), minute: wall.getUTCHours() * 60 + wall.getUTCMinutes() }
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** True when `minute` of `day` falls in that day's hours, or in last night's hours running past midnight. */
function inHours(hours: InboxDayHours[], day: number, minute: number): boolean {
  const today = hours.find((h) => h.day === day)
  if (today?.open) {
    const from = minutesOf(today.from)
    const to = minutesOf(today.to)
    if (from < to ? minute >= from && minute < to : minute >= from) return true
  }
  const yesterday = hours.find((h) => h.day === (day + 6) % 7)
  if (yesterday?.open) {
    const from = minutesOf(yesterday.from)
    const to = minutesOf(yesterday.to)
    if (from > to && minute < to) return true
  }
  return false
}

/** Whether the shop shows as online: always, never, or inside the weekly hours in the store's zone. */
export function isInboxAvailable(
  settings: Pick<InboxSettings, 'availability' | 'hours'>,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (settings.availability === 'always') return true
  if (settings.availability === 'offline') return false
  const { day, minute } = zonedWeekMinute(now, timeZone)
  return inHours(settings.hours, day, minute)
}

/** Whether the widget must ask for an email or phone before the first message. */
export function contactRequired(
  settings: Pick<InboxSettings, 'contactCapture'>,
  available: boolean,
): boolean {
  return settings.contactCapture === 'required_when_away' && !available
}
