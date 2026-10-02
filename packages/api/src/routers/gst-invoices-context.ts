/**
 * Request helpers shared by the GST invoices router (`./gst-invoices.ts`): the app-installed
 * gate, render deps bound to the request's transaction, error mapping to oRPC, and which GST
 * number a screen works on. Split out so the router stays one file per concern.
 */
import { settingsSecret } from '@commerce/config'
import type { StoreTx } from '@commerce/db'
import {
  counterYear,
  financialYear,
  formatSeriesNumber,
  type InvoiceSettings,
} from '@commerce/invoices'
import {
  documentIssuer,
  GST_INVOICES_ID,
  gstToken,
  InvoiceError,
  PeriodError,
  peekNext,
  type RenderDeps,
} from '@commerce/plugin-gst-invoices/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { getStoreApps, storeRegistries } from '../services/apps.service'
import { registrationScope } from '../services/gst-invoices.service'
import { storageProviderFor } from '../services/media.service'

export type Ctx = { tx: StoreTx; scope: { storeId: string } }

/** Every procedure here needs the store to have installed the app. */
export async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(GST_INVOICES_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the GST invoices app first' })
  }
}

/** Render deps bound to the request's own store-scoped transaction. */
export function renderDeps(context: Ctx): RenderDeps {
  return {
    storeId: context.scope.storeId,
    inStore: (fn) => fn(context.tx),
    storage: async () => {
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      return storageProviderFor(context.tx, context.scope.storeId, storage, settingsSecret())
    },
  }
}

export function asOrpc(err: unknown): never {
  if (err instanceof PeriodError) throw new ORPCError('BAD_REQUEST', { message: err.message })
  if (err instanceof InvoiceError) {
    const code =
      err.code === 'not_found' || err.code === 'order_not_found' ? 'NOT_FOUND' : 'BAD_REQUEST'
    throw new ORPCError(code, { message: err.message })
  }
  if (err instanceof z.ZodError) {
    throw new ORPCError('BAD_REQUEST', { message: err.issues[0]?.message ?? 'Invalid settings' })
  }
  throw err
}

/**
 * Which GST number a screen works on (the picker at the top of the app). Omitted: the store's
 * default; null: a store without a GST registration.
 */
export const Gst = z.uuid().nullable().optional()

/** A GST return month, 2026-09. */
export const Period = z.string().regex(/^20[0-9]{2}-(0[1-9]|1[0-2])$/)

/** The picked GSTIN, refused when it is not this store's; the default when none is picked. */
export async function gstScope(
  context: Ctx,
  picked: string | null | undefined,
): Promise<string | null> {
  const scope = await registrationScope(context.tx, picked)
  if (!scope) throw new ORPCError('NOT_FOUND', { message: 'GST number not found' })
  return scope.id
}

/** What each series will print next for one GSTIN this financial year. */
export async function nextNumbers(context: Ctx, settings: InvoiceSettings, gst: string | null) {
  const fy = financialYear(new Date())
  const issuer = await documentIssuer(context.tx, gst)
  const out: Record<string, string> = {}
  for (const series of settings.series) {
    const next = await peekNext(context.tx, gst, series.id, counterYear(series, fy))
    out[series.id] = formatSeriesNumber(series, fy, next, gstToken(issuer, settings))
  }
  return out
}
