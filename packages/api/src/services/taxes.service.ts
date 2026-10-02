import {
  adoptStoreGstin,
  defaultRegistrationGstin,
  documentRegistration,
  gstinStateOf,
  parseStoreTax,
  type TaxesForm,
  TaxesFormSchema,
  withStoreTax,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import {
  checkDocumentNumber,
  financialYear,
  formatSeriesNumber,
  type InvoiceSettings,
  pickSeries,
  SeriesSchema,
} from '@commerce/invoices'
import {
  GST_INVOICES_ID,
  gstToken,
  loadSettings,
  nextNumberFloor,
  saveSettings,
  setNextNumber,
} from '@commerce/plugin-gst-invoices/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getStoreApps } from './apps.service'

/**
 * Settings › Taxes & GST. Nothing here is stored twice: GSTIN and default rate
 * are store columns, the two switches sit in `store.apps.settings.core.tax`,
 * and legal name, registered address, default HSN and invoice numbering are
 * the GST invoices app's own seller block, `defaultHsn` and domestic
 * tax-invoice series, so that app and this page always agree.
 */

const NumberingInputSchema = z.object({
  /** The series pattern: text before the running number, `{FY}` for the year. */
  prefix: SeriesSchema.shape.pattern,
  resetEachYear: z.boolean(),
  nextNumber: z.coerce.number().int().min(1),
})

export const TaxesInputSchema = TaxesFormSchema.extend({ numbering: NumberingInputSchema })
export type TaxesInput = z.infer<typeof TaxesInputSchema>

export type TaxesView = {
  form: TaxesForm
  numbering: {
    prefix: string
    resetEachYear: boolean
    nextNumber: number
    /** Numbers below this are already used this financial year. */
    lowest: number
    pad: number
  }
  /** Numbered invoices come from the GST invoices app; without it, numbering waits. */
  invoicesAppInstalled: boolean
  /** Settings › Business and GST owns the GSTIN (the store has a default registration). */
  gstinManaged: boolean
}

export class TaxesError extends Error {}

/** The series B2C invoices shipped inside India are numbered from. */
const domesticSeries = (settings: InvoiceSettings) =>
  pickSeries(settings.series, 'tax_invoice', { export: false, b2b: false })

export async function getTaxes(tx: StoreTx, storeId: string): Promise<TaxesView | null> {
  const [s] = await tx
    .select({ gstin: store.gstin, gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, storeId))
  if (!s) return null
  const invoices = await loadSettings(tx, storeId)
  const tax = parseStoreTax(s.apps)
  const series = domesticSeries(invoices)
  // This page numbers the default GST number's invoices; others follow the same series.
  const registration = await documentRegistration(tx, null)
  const lowest = series
    ? await nextNumberFloor(tx, registration?.id ?? null, series, new Date())
    : 1
  const apps = await getStoreApps(tx, storeId)
  return {
    form: {
      gstin: s.gstin ?? '',
      legalName: invoices.seller.legalName,
      address: {
        line1: invoices.seller.line1,
        line2: invoices.seller.line2,
        city: invoices.seller.city,
        pincode: invoices.seller.pincode,
      },
      gstRatePercent: s.gstRatePercent,
      defaultHsn: invoices.defaultHsn,
      pricesIncludeGst: tax.pricesIncludeGst,
      composition: tax.composition,
    },
    numbering: {
      prefix: series?.pattern ?? '',
      resetEachYear: series?.resetEachYear !== false,
      nextNumber: lowest,
      lowest,
      pad: series?.pad ?? 4,
    },
    invoicesAppInstalled: apps.installed.includes(GST_INVOICES_ID),
    gstinManaged: (await defaultRegistrationGstin(tx)) !== null,
  }
}

/** The GST invoices app's settings with this page's fields written in. */
function withTaxesInput(settings: InvoiceSettings, input: TaxesInput): InvoiceSettings {
  const domestic = domesticSeries(settings)
  return {
    ...settings,
    seller: {
      ...settings.seller,
      legalName: input.legalName,
      gstin: input.gstin,
      // The GSTIN says where the business is registered; keep the old state without one.
      stateCode: gstinStateOf(input.gstin)?.code ?? settings.seller.stateCode,
      line1: input.address.line1,
      line2: input.address.line2,
      city: input.address.city,
      pincode: input.address.pincode,
    },
    defaultHsn: input.defaultHsn,
    series: settings.series.map((s) =>
      s.id === domestic?.id
        ? { ...s, pattern: input.numbering.prefix, resetEachYear: input.numbering.resetEachYear }
        : s,
    ),
  }
}

export async function saveTaxes(
  tx: StoreTx,
  storeId: string,
  input: TaxesInput,
): Promise<TaxesView | null> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  if (!s) return null
  // Business and GST owns the GSTIN once the store has one (see adoptStoreGstin).
  await adoptStoreGstin(tx, storeId, input.gstin, input.legalName)
  await tx
    .update(store)
    .set({
      gstin: input.gstin === '' ? null : input.gstin,
      gstRatePercent: input.gstRatePercent,
      apps: withStoreTax(s.apps, {
        pricesIncludeGst: input.pricesIncludeGst,
        composition: input.composition,
      }),
    })
    .where(eq(store.id, storeId))

  const settings = await saveSettings(
    tx,
    storeId,
    withTaxesInput(await loadSettings(tx, storeId), input),
  )
  const series = domesticSeries(settings)
  if (series) {
    const registration = await documentRegistration(tx, null)
    const sample = formatSeriesNumber(
      series,
      financialYear(new Date()),
      input.numbering.nextNumber,
      gstToken(registration, settings),
    )
    if (!checkDocumentNumber(sample).ok) {
      throw new TaxesError(`Invoice numbers can be at most 16 characters; ${sample} is too long`)
    }
    // Always written, so switching the yearly restart on or off carries the count over.
    await setNextNumber(tx, storeId, registration?.id ?? null, series, input.numbering.nextNumber)
  }
  return getTaxes(tx, storeId)
}
