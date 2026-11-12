/** SOURCE OF TRUTH: recordEmailFeedback, emailSuppressionFor, listEmailSuppressions, allowEmailAgain, activeSuppressions — WHAT: a store's list of addresses it stops mailing after SES reported a hard bounce, repeated soft bounces or a spam complaint, and "Allow again" / WHY: mailing addresses that bounce or complain hurts the SES account every store sends through */
import {
  type EmailSuppressionReason,
  emailFeedbackEvent,
  emailSuppression,
  type StoreTx,
} from '@commerce/db'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import type { SesFeedback } from './ses-feedback'

/** Soft (transient) bounces in the window that put an address on the list. */
export const SOFT_BOUNCE_LIMIT = 3
export const SOFT_BOUNCE_WINDOW_DAYS = 14

export type EmailSuppressionRow = typeof emailSuppression.$inferSelect

/** Lower case and trimmed, the form every row stores. */
const normaliseEmail = (email: string) => email.trim().toLowerCase()

/** Why this one recipient's feedback suppresses the address now, or null when it does not (yet). */
async function reasonFor(
  tx: StoreTx,
  storeId: string,
  email: string,
  feedback: SesFeedback,
  now: Date,
): Promise<EmailSuppressionReason | null> {
  if (feedback.kind === 'complaint') return 'complaint'
  if (feedback.bounceType === 'Permanent') return 'hard_bounce'
  // Transient or Undetermined: count soft bounces since the window opened, or since staff
  // allowed the address again, whichever is later.
  const [prior] = await tx
    .select({ clearedAt: emailSuppression.clearedAt })
    .from(emailSuppression)
    .where(and(eq(emailSuppression.storeId, storeId), eq(emailSuppression.email, email)))
  const windowStart = new Date(now.getTime() - SOFT_BOUNCE_WINDOW_DAYS * 86_400_000)
  const since = prior?.clearedAt && prior.clearedAt > windowStart ? prior.clearedAt : windowStart
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(emailFeedbackEvent)
    .where(
      and(
        eq(emailFeedbackEvent.storeId, storeId),
        eq(emailFeedbackEvent.email, email),
        eq(emailFeedbackEvent.kind, 'bounce'),
        sql`${emailFeedbackEvent.bounceType} is distinct from 'Permanent'`,
        gt(emailFeedbackEvent.createdAt, since),
      ),
    )
  return (row?.n ?? 0) >= SOFT_BOUNCE_LIMIT ? 'soft_bounces' : null
}

/**
 * Record one SNS notification's bounce or complaint for a store and suppress the addresses it
 * calls for. Idempotent: the same SNS message for the same address is recorded once, so a
 * redelivery never counts twice. Returns the addresses newly suppressed.
 */
export async function recordEmailFeedback(
  tx: StoreTx,
  storeId: string,
  snsMessageId: string,
  feedback: SesFeedback,
  now: Date = new Date(),
): Promise<{ recorded: number; suppressed: string[] }> {
  let recorded = 0
  const suppressed: string[] = []
  for (const r of feedback.recipients) {
    const email = normaliseEmail(r.email)
    const inserted = await tx
      .insert(emailFeedbackEvent)
      .values({
        storeId,
        snsMessageId,
        email,
        kind: feedback.kind,
        bounceType: feedback.bounceType,
        subType: feedback.subType,
        detail: r.detail,
        sesMessageId: feedback.sesMessageId,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [
          emailFeedbackEvent.storeId,
          emailFeedbackEvent.snsMessageId,
          emailFeedbackEvent.email,
        ],
      })
      .returning({ id: emailFeedbackEvent.id })
    if (inserted.length === 0) continue
    recorded += 1
    const reason = await reasonFor(tx, storeId, email, feedback, now)
    if (!reason) continue
    const detail = r.detail ?? feedback.subType
    // A new address, or one staff allowed again: (re)suppress. One already suppressed stays as is.
    const rows = await tx
      .insert(emailSuppression)
      .values({ storeId, email, reason, detail, suppressedAt: now })
      .onConflictDoUpdate({
        target: [emailSuppression.storeId, emailSuppression.email],
        set: { reason, detail, suppressedAt: now, clearedAt: null, clearedBy: null },
        setWhere: sql`${emailSuppression.clearedAt} is not null`,
      })
      .returning({ id: emailSuppression.id })
    if (rows.length > 0) suppressed.push(email)
  }
  return { recorded, suppressed }
}

/** The active suppression for an address, or null when the store may mail it. */
export async function emailSuppressionFor(
  tx: StoreTx,
  email: string,
): Promise<EmailSuppressionRow | null> {
  const [row] = await tx
    .select()
    .from(emailSuppression)
    .where(
      and(eq(emailSuppression.email, normaliseEmail(email)), isNull(emailSuppression.clearedAt)),
    )
  return row ?? null
}

/**
 * Every address the store is not mailing right now (address and reason only), loaded once when
 * a store's channels are built. One indexed read; the list holds only addresses that failed.
 */
export async function activeSuppressions(
  tx: StoreTx,
): Promise<Map<string, EmailSuppressionReason>> {
  const rows = await tx
    .select({ email: emailSuppression.email, reason: emailSuppression.reason })
    .from(emailSuppression)
    .where(isNull(emailSuppression.clearedAt))
  return new Map(rows.map((r) => [r.email, r.reason]))
}

/** The store's active suppressions, newest first, for Settings › Notifications › Sender email. */
export async function listEmailSuppressions(
  tx: StoreTx,
  opts: { limit?: number | undefined } = {},
): Promise<EmailSuppressionRow[]> {
  return tx
    .select()
    .from(emailSuppression)
    .where(isNull(emailSuppression.clearedAt))
    .orderBy(desc(emailSuppression.suppressedAt))
    .limit(Math.min(Math.max(opts.limit ?? 100, 1), 500))
}

/**
 * "Allow again": the store mails the address again. Only feedback after this counts towards a
 * new suppression. False when the address was not suppressed.
 */
export async function allowEmailAgain(
  tx: StoreTx,
  email: string,
  by: string | null,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await tx
    .update(emailSuppression)
    .set({ clearedAt: now, clearedBy: by })
    .where(
      and(eq(emailSuppression.email, normaliseEmail(email)), isNull(emailSuppression.clearedAt)),
    )
    .returning({ id: emailSuppression.id })
  return rows.length > 0
}
