/** SOURCE OF TRUTH: handleSesSnsWebhook — WHAT: one Amazon SNS POST to the worker: check it is signed by SNS and from our topic, confirm a new subscription, or record the SES bounce or complaint it carries against the right store / WHY: the worker route stays a thin HTTP shell; every decision lives here and is tested without AWS */
import { type Db, store, storeForEmailFeedback, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { parseNotificationSettings } from '../notifications/settings'
import { recordEmailFeedback } from './service'
import { parseSesFeedback } from './ses-feedback'
import {
  type CertFetcher,
  fetchSnsCert,
  parseSnsEnvelope,
  snsSubscribeUrlAllowed,
  verifySnsMessage,
} from './sns'

export type SesWebhookDeps = {
  /** `SES_EVENTS_TOPIC_ARN`. Unset: every message is refused (the feature is off). */
  topicArn: string | undefined
  /** Fetches AWS's signing certificate; tests pass their own. */
  fetchCert?: CertFetcher | undefined
  /** Visits a SubscribeURL to confirm; tests pass their own. */
  confirm?: ((url: string) => Promise<void>) | undefined
  /** Finds the store for a bounce; tests pass their own. Default: `storeForEmailFeedback`. */
  findStore?:
    | ((hint: { storeTag: string | null; fromDomain: string | null }) => Promise<string | null>)
    | undefined
  now?: Date | undefined
}

/**
 * What happened. `rejected` answers 400 with the generic body; every other outcome answers 200
 * so SNS stops retrying (an `ignored` message is valid but not ours to act on).
 */
export type SesWebhookOutcome =
  | { status: 'rejected'; reason: string }
  | { status: 'confirmed' }
  | { status: 'ignored'; reason: string }
  | { status: 'recorded'; storeId: string; recorded: number; suppressed: number }

const CONFIRM_TIMEOUT_MS = 5_000

/** GET the SubscribeURL (already checked to be https on an SNS host); no redirects. */
async function confirmSubscription(url: string): Promise<void> {
  const res = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(CONFIRM_TIMEOUT_MS),
  })
  await res.body?.cancel()
  if (!res.ok) throw new Error(`SNS ConfirmSubscription: HTTP ${res.status}`)
}

/**
 * Handle one SNS POST. Throws only on a database or network failure, which the route turns into
 * a 500 so SNS retries; a redelivered message is a no-op (`recordEmailFeedback` is idempotent).
 */
export async function handleSesSnsWebhook(
  db: Db,
  rawBody: string,
  deps: SesWebhookDeps,
): Promise<SesWebhookOutcome> {
  if (!deps.topicArn) return { status: 'rejected', reason: 'SES_EVENTS_TOPIC_ARN is not set' }
  const m = parseSnsEnvelope(rawBody)
  if (!m) return { status: 'rejected', reason: 'not an SNS message' }
  // The signature proves SNS sent it, not that it is our topic: anyone can sign from their own.
  if (m.TopicArn !== deps.topicArn) return { status: 'rejected', reason: 'unexpected topic' }
  const verified = await verifySnsMessage(m, {
    fetchCert: deps.fetchCert ?? fetchSnsCert(),
    now: deps.now,
  })
  if (!verified.ok) return { status: 'rejected', reason: `signature: ${verified.reason}` }

  if (m.Type === 'SubscriptionConfirmation') {
    if (!m.SubscribeURL || !snsSubscribeUrlAllowed(m.SubscribeURL)) {
      return { status: 'rejected', reason: 'subscribe url not on an SNS host' }
    }
    await (deps.confirm ?? confirmSubscription)(m.SubscribeURL)
    return { status: 'confirmed' }
  }
  if (m.Type === 'UnsubscribeConfirmation') return { status: 'ignored', reason: 'unsubscribed' }

  const feedback = parseSesFeedback(m.Message)
  if (!feedback) return { status: 'ignored', reason: 'not a bounce or complaint' }
  const storeId = await (deps.findStore ?? ((hint) => storeForEmailFeedback(db, hint)))({
    storeTag: feedback.storeTag,
    fromDomain: feedback.fromDomain,
  })
  if (!storeId) return { status: 'ignored', reason: 'no store for this message' }
  const r = await withStore(db, storeId, (tx) =>
    recordEmailFeedback(tx, storeId, m.MessageId, feedback, deps.now),
  )
  return { status: 'recorded', storeId, recorded: r.recorded, suppressed: r.suppressed.length }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The SNS topic a store's own Amazon SES account publishes bounces and complaints to (the SES
 * app's "SNS topic ARN"), or null when the app is off or the field is empty.
 */
export async function storeSesEventsTopic(db: Db, storeId: string): Promise<string | null> {
  if (!UUID.test(storeId)) return null
  return withStore(db, storeId, async (tx) => {
    const [s] = await tx
      .select({ notifications: store.notifications })
      .from(store)
      .where(eq(store.id, storeId))
    const settings = parseNotificationSettings(s?.notifications)
    if (!settings.enabled.includes('ses')) return null
    const topic = (settings.providers.ses as Record<string, unknown> | undefined)?.eventsTopicArn
    return typeof topic === 'string' && topic.trim() ? topic.trim() : null
  })
}

/**
 * One SNS POST from a store's own SES account (`/webhooks/email/ses/<store id>`): the same checks
 * as the platform topic, but the topic must be the one this store saved, and what it reports is
 * recorded for this store only (a message tagged with another store is ignored).
 */
export async function handleStoreSesSnsWebhook(
  db: Db,
  storeId: string,
  rawBody: string,
  deps: Omit<SesWebhookDeps, 'topicArn' | 'findStore'> & {
    /** Tests pass the topic; otherwise it is read from the store's SES settings. */
    topicArn?: string | null | undefined
  } = {},
): Promise<SesWebhookOutcome> {
  const topicArn = deps.topicArn ?? (await storeSesEventsTopic(db, storeId))
  if (!topicArn) return { status: 'rejected', reason: 'no SES events topic for this store' }
  return handleSesSnsWebhook(db, rawBody, {
    ...deps,
    topicArn,
    findStore: async (hint) => (!hint.storeTag || hint.storeTag === storeId ? storeId : null),
  })
}
