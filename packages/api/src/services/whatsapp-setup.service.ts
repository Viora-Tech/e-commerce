import {
  decryptNotificationSettings,
  loadPlatformAccount,
  MESSAGE_CATALOGUE,
  parseNotificationSettings,
} from '@commerce/core'
import { notification, order, type StoreTx } from '@commerce/db'
import type {
  ChannelTemplateSpec,
  ChannelTemplateStatus,
  NotificationChannel,
  NotificationRegistry,
  TemplateId,
} from '@commerce/notifications'
import { and, desc, eq, lt } from 'drizzle-orm'
import { getStore } from './store.service'

const WHATSAPP = 'whatsapp'

/** "Order confirmed, shipped and delivered": what step 3 of Setup needs approved. */
const SETUP_TEMPLATES: readonly TemplateId[] = ['order_placed', 'order_shipped', 'delivered']

/** The two messages the "What shoppers get" card shows. */
const PREVIEW_TEMPLATES: readonly TemplateId[] = ['order_placed', 'order_shipped']

/**
 * Every message the store may send on WhatsApp: the catalogue's WhatsApp messages, plus the
 * sign-in code, which phone sign-in sends on WhatsApp whatever the catalogue lists for email.
 */
export const WHATSAPP_TEMPLATE_IDS: readonly TemplateId[] = [
  ...MESSAGE_CATALOGUE.filter((m) => m.channels.includes('whatsapp')).map((m) => m.id),
  ...(MESSAGE_CATALOGUE.some((m) => m.id === 'login_code' && m.channels.includes('whatsapp'))
    ? []
    : (['login_code'] as const)),
]

export type WhatsappDeps = {
  registry: NotificationRegistry
  secret: string
  previousSecrets?: string[] | undefined
}

export type TemplateState = 'approved' | 'pending' | 'rejected' | 'not_submitted'

/**
 * `live`: the saved access token and WhatsApp Business Account ID let us read and submit
 * templates with Meta. `no_waba`: a number and token are saved but not the account ID.
 * `no_connection`: nothing usable is saved yet.
 */
export type TemplateAccess = 'live' | 'no_waba' | 'no_connection'

/** Meta's review status, in the four words the Templates page uses. */
function templateState(status: string | undefined): TemplateState {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'approved'
    case 'PENDING':
    case 'IN_APPEAL':
    case 'PENDING_DELETION':
      return 'pending'
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
    case 'LIMIT_EXCEEDED':
      return 'rejected'
    default:
      return 'not_submitted'
  }
}

/**
 * The account's template for a spec: same name in the store's language, else the same name in
 * any language (Meta keeps `en` and `en_US` apart; the sender uses the store's language).
 */
function matchTemplate(
  spec: Pick<ChannelTemplateSpec, 'name'>,
  statuses: readonly ChannelTemplateStatus[],
  language: string,
): ChannelTemplateStatus | undefined {
  const named = statuses.filter((s) => s.name === spec.name)
  return named.find((s) => s.language === language) ?? named[0]
}

/** "+91 98100 12345" → "+91 98100 •••••": enough to recognise it, never the whole number. */
function maskPhone(phone: string): string {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 6) return trimmed
  let seen = 0
  const keep = digits.length - 5
  return trimmed.replace(/\d/g, (d) => {
    seen += 1
    return seen > keep ? '•' : d
  })
}

/** A spec's body with its examples in place of `{{n}}`: what a shopper reads. */
function fillTemplate(spec: Pick<ChannelTemplateSpec, 'body' | 'examples'>): string {
  return spec.body.replace(/\{\{(\d+)\}\}/g, (all, n) => spec.examples[Number(n) - 1] ?? all)
}

type Loaded = {
  storeName: string
  enabled: boolean
  raw: Record<string, string>
  language: string
  channel: NotificationChannel | null
  specs: ChannelTemplateSpec[]
}

/** The store's WhatsApp settings decrypted, its channel (when the saved details validate) and specs. */
async function load(tx: StoreTx, storeId: string, deps: WhatsappDeps): Promise<Loaded> {
  const s = await getStore(tx, storeId)
  const settings = parseNotificationSettings(s?.notifications)
  const decrypted = decryptNotificationSettings(settings, deps.secret, deps.previousSecrets ?? [])
  const raw = (decrypted.providers[WHATSAPP] ?? {}) as Record<string, string>
  const factory = deps.registry.get(WHATSAPP)
  const created = factory ? deps.registry.create(WHATSAPP, raw) : null
  const storeName = s?.name ?? ''
  return {
    storeName,
    enabled: settings.enabled.includes(WHATSAPP),
    raw,
    language: raw.templateLanguage?.trim() || 'en',
    channel: created?.ok ? created.channel : null,
    specs: factory?.templateSpecs?.(WHATSAPP_TEMPLATE_IDS, storeName) ?? [],
  }
}

const accessOf = (l: Loaded): TemplateAccess =>
  !l.channel ? 'no_connection' : l.raw.businessAccountId?.trim() ? 'live' : 'no_waba'

/**
 * Apps → WhatsApp → Setup: the three steps' state from what is saved (the number, the Meta
 * connection) and the two sample messages. Template approval comes from `whatsappTemplates`.
 */
export async function whatsappSetup(tx: StoreTx, storeId: string, deps: WhatsappDeps) {
  const l = await load(tx, storeId, deps)
  const account = await loadPlatformAccount({ tx, storeId }, WHATSAPP)
  const detail = account?.detail ?? {}
  const display = detail.displayPhone || ''
  const phoneNumberId = l.raw.phoneNumberId?.trim() || detail.phoneNumberId || ''
  const accountOk = !account || account.status === 'active'
  return {
    number: phoneNumberId
      ? {
          label: display ? maskPhone(display) : null,
          verified: Boolean(detail.verifiedName) || detail.registered === 'yes',
        }
      : null,
    connected: Boolean(l.channel) && l.enabled && accountOk,
    via: account ? ('signup' as const) : l.channel ? ('manual' as const) : null,
    access: accessOf(l),
    testMode: l.raw.useTextMessages === 'true',
    required: SETUP_TEMPLATES,
    previews: PREVIEW_TEMPLATES.flatMap((id) => {
      const spec = l.specs.find((s) => s.id === id)
      return spec ? [{ id, text: fillTemplate(spec) }] : []
    }),
  }
}

/**
 * Apps → WhatsApp → Templates: every message the store can send on WhatsApp, with the template
 * name, body and examples to submit, and Meta's review status when the saved access can ask.
 * A Meta error comes back as `error` (in Meta's words) with the list still filled in.
 */
export async function whatsappTemplates(tx: StoreTx, storeId: string, deps: WhatsappDeps) {
  const l = await load(tx, storeId, deps)
  const access = accessOf(l)
  let statuses: ChannelTemplateStatus[] | null = null
  let error: string | null = null
  if (access === 'live' && l.channel?.templateStatuses) {
    try {
      statuses = await l.channel.templateStatuses()
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }
  return {
    access,
    language: l.language,
    error,
    /** False when the list below could not be read, so "Not submitted" is a guess. */
    statusKnown: statuses !== null,
    templates: l.specs.map((spec) => {
      const found = statuses ? matchTemplate(spec, statuses, l.language) : undefined
      return {
        ...spec,
        status: templateState(found?.status),
        language: found?.language ?? l.language,
        rejectedReason: found?.rejectedReason ?? null,
        preview: fillTemplate(spec),
      }
    }),
  }
}

export type SubmitResult =
  | { id: TemplateId; ok: true; status: TemplateState }
  | { id: TemplateId; ok: false; error: string }

/**
 * "Submit to Meta": sends each message's template for review, one at a time, and says per
 * message what Meta answered. Messages already on the account (any status) are left alone.
 */
export async function submitWhatsappTemplates(
  tx: StoreTx,
  storeId: string,
  ids: readonly TemplateId[],
  deps: WhatsappDeps,
): Promise<{ access: TemplateAccess; results: SubmitResult[] }> {
  const l = await load(tx, storeId, deps)
  const access = accessOf(l)
  const channel = l.channel
  if (access !== 'live' || !channel?.submitTemplate) return { access, results: [] }
  let existing: ChannelTemplateStatus[] = []
  if (channel.templateStatuses) {
    try {
      existing = await channel.templateStatuses()
    } catch {
      // Could not read the list: submit anyway; Meta refuses a duplicate in its own words.
    }
  }
  const results: SubmitResult[] = []
  for (const id of ids) {
    const spec = l.specs.find((s) => s.id === id)
    if (!spec) {
      results.push({ id, ok: false, error: 'This message is not sent on WhatsApp' })
      continue
    }
    const found = matchTemplate(spec, existing, l.language)
    if (found) {
      results.push({ id, ok: true, status: templateState(found.status) })
      continue
    }
    try {
      const r = await channel.submitTemplate(spec)
      results.push({ id, ok: true, status: templateState(r.status) })
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { access, results }
}

/** Rows per page of the WhatsApp message log. */
const MESSAGE_PAGE = 50

/**
 * Apps → WhatsApp → Messages: what the store's WhatsApp channel sent (or failed to send), newest
 * first, from the notification log every send writes. `before` pages on by the last row's time.
 */
export async function whatsappMessages(
  tx: StoreTx,
  input: { before?: string | undefined; status?: 'queued' | 'sent' | 'failed' | undefined },
) {
  const rows = await tx
    .select({
      id: notification.id,
      template: notification.template,
      to: notification.to,
      status: notification.status,
      error: notification.error,
      orderId: notification.orderId,
      orderNumber: order.number,
      providerRef: notification.providerRef,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .leftJoin(order, eq(order.id, notification.orderId))
    .where(
      and(
        eq(notification.channel, WHATSAPP),
        input.status ? eq(notification.status, input.status) : undefined,
        input.before ? lt(notification.createdAt, new Date(input.before)) : undefined,
      ),
    )
    .orderBy(desc(notification.createdAt))
    .limit(MESSAGE_PAGE + 1)
  const page = rows.slice(0, MESSAGE_PAGE)
  return {
    // Staff see shoppers' numbers on their orders already; the log shows them whole.
    rows: page.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    next: rows.length > MESSAGE_PAGE ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  }
}
