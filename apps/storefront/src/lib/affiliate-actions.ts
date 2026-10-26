'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  AFFILIATE_PORTAL_PATH,
  AffiliateError,
  affiliateForCustomer,
  affiliateState,
  applyAsAffiliate,
  cleanAnswers,
  cleanChannels,
  defaultProgram,
  enrolFromOrder,
  enrolOrderId,
  type PayoutDetails,
  PayoutDetailsSchema,
  PROMOTE_ANSWER,
  programBySlug,
  requestCode,
  savePayoutDetails,
  withProgramRules,
} from '@commerce/plugin-affiliates/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { currentCustomer } from './customer-session'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/*
 * The affiliate portal's actions (`/affiliate`). The store is the one the hostname resolved
 * to and the affiliate is always the signed-in shopper's own record, never an id from the
 * form. Payout details are encrypted before they are saved and never logged.
 */

export type AffiliateActionResult = { ok: true } | { ok: false; error: string }

const APPLY_RULE = { limit: 5, windowMs: 60 * 60_000 }
const PAYOUT_RULE = { limit: 10, windowMs: 60 * 60_000 }

async function ipKey(storeId: string): Promise<string> {
  return `${storeId}:${clientIp(await headers())}`
}

export async function applyAffiliateAction(input: {
  name: string
  social: string
  message: string
  acceptTerms: boolean
  /** The program's link slug from `?program=`; none joins the default program. */
  program?: string | undefined
  /** Answers to the program's own signup questions, by field id. */
  answers?: Record<string, string | boolean> | undefined
  /** Where they will share their link (`PROMOTE_CHANNELS`). */
  channels?: string[] | undefined
  /** How they want to be paid, given now so the first payout is not held up; optional. */
  payout?: PayoutDetails | undefined
}): Promise<AffiliateActionResult & { field?: string }> {
  const storeId = await requestStoreId()
  const me = await currentCustomer(storeId)
  if (!me) return { ok: false, error: 'signin' }
  if (!input.acceptTerms) return { ok: false, error: 'terms' }
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'name' }
  const payout = input.payout ? PayoutDetailsSchema.safeParse(input.payout) : null
  if (payout && !payout.success) {
    return { ok: false, error: 'payout', field: String(payout.error.issues[0]?.path[0] ?? '') }
  }
  const channels = cleanChannels(input.channels)
  if (!(await rateLimited('affiliate-apply:ip', await ipKey(storeId), APPLY_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const ip = clientIp(await headers())
  const result = await inStore(storeId, async (tx) => {
    const { installed, settings } = await affiliateState(tx, storeId)
    if (!installed || !settings.active) return 'closed' as const
    const slug = String(input.program ?? '').trim()
    const program = slug
      ? await programBySlug(tx, storeId, slug)
      : await defaultProgram(tx, storeId)
    if (!program) return 'closed' as const
    const form = cleanAnswers(program.rules.form, input.answers ?? {})
    if (form.missing) return 'missing' as const
    const row = await applyAsAffiliate(
      tx,
      storeId,
      {
        customerId: me.id,
        email: me.email,
        phone: me.phone,
        name,
        social: String(input.social ?? ''),
        message: String(input.message ?? ''),
        programId: program.id,
        ip,
        answers: channels.length
          ? { ...form.answers, [PROMOTE_ANSWER]: channels.join(',') }
          : form.answers,
      },
      withProgramRules(settings, program.rules),
      settingsSecret(),
    ).catch((err: unknown) => {
      if (err instanceof AffiliateError && err.code === 'AFFILIATE_BLOCKED') return null
      throw err
    })
    // Encrypted like the dashboard's form; a second application never replaces saved details.
    if (row && payout?.success && !row.payoutDetails) {
      await savePayoutDetails(tx, row.id, payout.data, settingsSecret())
    }
    return 'ok' as const
  })
  if (result !== 'ok') return { ok: false, error: result }
  revalidatePath(AFFILIATE_PORTAL_PATH)
  return { ok: true }
}

const CODE_RULE = { limit: 5, windowMs: 60 * 60_000 }

/** The affiliate asks for their own code; the merchant approves it in the admin. */
export async function requestCodeAction(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const storeId = await requestStoreId()
  const me = await currentCustomer(storeId)
  if (!me) return { ok: false, error: 'signin' }
  if (!(await rateLimited('affiliate-code:ip', await ipKey(storeId), CODE_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  try {
    await inStore(storeId, async (tx) => {
      const row = await affiliateForCustomer(tx, storeId, me.id)
      if (!row) throw new AffiliateError('AFFILIATE_NOT_APPROVED', 'Not an affiliate')
      await requestCode(tx, storeId, row.id, String(code ?? ''))
    })
  } catch (err) {
    if (err instanceof AffiliateError) {
      return {
        ok: false,
        error:
          err.code === 'CODE_TAKEN' ? 'taken' : err.code === 'CODE_INVALID' ? 'invalid' : 'generic',
      }
    }
    throw err
  }
  revalidatePath(AFFILIATE_PORTAL_PATH)
  return { ok: true }
}

export type JoinActionResult =
  | { ok: true; code: string; couponCode: string | null }
  | { ok: false; error: 'busy' | 'closed' }

/**
 * Share and earn: the buyer's one tap on the invite from their order. The signed token names
 * the store and the order; the affiliate made is always that order's own customer.
 */
export async function joinFromOrderAction(token: string): Promise<JoinActionResult> {
  const storeId = await requestStoreId()
  const orderId = enrolOrderId(token, storeId, settingsSecret())
  if (!orderId) return { ok: false, error: 'closed' }
  if (!(await rateLimited('affiliate-apply:ip', await ipKey(storeId), APPLY_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const row = await inStore(storeId, (tx) => enrolFromOrder(tx, storeId, orderId, settingsSecret()))
  if (row?.status !== 'approved') return { ok: false, error: 'closed' }
  revalidatePath(AFFILIATE_PORTAL_PATH)
  return { ok: true, code: row.code, couponCode: row.couponCode }
}

export async function savePayoutDetailsAction(
  input: PayoutDetails,
): Promise<AffiliateActionResult & { field?: string }> {
  const storeId = await requestStoreId()
  const me = await currentCustomer(storeId)
  if (!me) return { ok: false, error: 'signin' }
  const parsed = PayoutDetailsSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: 'invalid', field: String(issue?.path[0] ?? '') }
  }
  if (!(await rateLimited('affiliate-payout:ip', await ipKey(storeId), PAYOUT_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const saved = await inStore(storeId, async (tx) => {
    const row = await affiliateForCustomer(tx, storeId, me.id)
    if (row?.status !== 'approved') return false
    await savePayoutDetails(tx, row.id, parsed.data, settingsSecret())
    return true
  })
  if (!saved) return { ok: false, error: 'not_affiliate' }
  revalidatePath(AFFILIATE_PORTAL_PATH)
  return { ok: true }
}
