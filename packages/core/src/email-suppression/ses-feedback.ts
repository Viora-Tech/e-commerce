/** SOURCE OF TRUTH: parseSesFeedback — WHAT: an SES bounce or complaint notification (configuration-set event publishing, `eventType`, or identity notifications, `notificationType`) as one plain shape: who bounced or complained, how, and which store the mail came from / WHY: the suppression service decides from this alone, whichever way SES delivered it */

export type SesFeedbackRecipient = { email: string; detail: string | null }

export type SesFeedback = {
  kind: 'bounce' | 'complaint'
  /** `Permanent`, `Transient` or `Undetermined`; null for a complaint. */
  bounceType: string | null
  /** `bounceSubType`, or the complaint's feedback type. */
  subType: string | null
  recipients: SesFeedbackRecipient[]
  /** SES id of the email the feedback is about. */
  sesMessageId: string | null
  /** The `store-id` tag the platform put on the send, when present. */
  storeTag: string | null
  /** The From address's domain, to find the store when there is no tag. */
  fromDomain: string | null
}

type Obj = Record<string, unknown>

const obj = (v: unknown): Obj | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

/** `Name <a@b.c>` or `a@b.c` to `a@b.c`, lower case; null when it is not an address. */
function bareAddress(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  const inner = /<([^<>]+)>\s*$/.exec(raw)?.[1] ?? raw
  const email = inner.trim().toLowerCase()
  return ADDRESS.test(email) && email.length <= 320 ? email : null
}

/** First value of an SES tag (`mail.tags` maps a name to a list of values). */
function tag(mail: Obj | null, name: string): string | null {
  const values = obj(mail?.tags)?.[name]
  return Array.isArray(values) ? text(values[0]) : null
}

/** Cut a server's words to something a row can hold and a screen can show. */
const clip = (v: string | null) => (v && v.length > 500 ? `${v.slice(0, 499)}…` : v)

/**
 * The feedback in an SES notification, or null for anything else (a delivery, a send event,
 * a malformed body). Recipients without a valid address are dropped.
 */
export function parseSesFeedback(message: string): SesFeedback | null {
  let body: Obj | null
  try {
    body = obj(JSON.parse(message))
  } catch {
    return null
  }
  if (!body) return null
  const type = text(body.eventType) ?? text(body.notificationType)
  const mail = obj(body.mail)
  const storeTag = tag(mail, 'store-id')
  const fromDomain =
    tag(mail, 'ses:from-domain')?.toLowerCase() ?? bareAddress(mail?.source)?.split('@')[1] ?? null
  const base = {
    sesMessageId: text(mail?.messageId),
    storeTag: storeTag && UUID.test(storeTag) ? storeTag.toLowerCase() : null,
    fromDomain,
  }

  if (type === 'Bounce') {
    const bounce = obj(body.bounce)
    const list = Array.isArray(bounce?.bouncedRecipients) ? bounce.bouncedRecipients : []
    const recipients = list.flatMap((r): SesFeedbackRecipient[] => {
      const row = obj(r)
      const email = bareAddress(row?.emailAddress)
      return email ? [{ email, detail: clip(text(row?.diagnosticCode) ?? text(row?.status)) }] : []
    })
    if (recipients.length === 0) return null
    return {
      kind: 'bounce',
      bounceType: text(bounce?.bounceType) ?? 'Undetermined',
      subType: text(bounce?.bounceSubType),
      recipients,
      ...base,
    }
  }

  if (type === 'Complaint') {
    const complaint = obj(body.complaint)
    const list = Array.isArray(complaint?.complainedRecipients)
      ? complaint.complainedRecipients
      : []
    const subType = text(complaint?.complaintFeedbackType) ?? text(complaint?.complaintSubType)
    const recipients = list.flatMap((r): SesFeedbackRecipient[] => {
      const email = bareAddress(obj(r)?.emailAddress)
      return email ? [{ email, detail: subType }] : []
    })
    if (recipients.length === 0) return null
    return { kind: 'complaint', bounceType: null, subType, recipients, ...base }
  }

  return null
}
