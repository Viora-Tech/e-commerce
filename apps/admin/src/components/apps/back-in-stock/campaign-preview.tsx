'use client'

import {
  BUTTON_RADIUS_REM,
  describeProduct,
  notifyWidgetOf,
} from '@commerce/plugin-back-in-stock/settings-schema'
import { X } from '@commerce/ui/icons'
import type { CSSProperties } from 'react'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignForm, CampaignTab } from './campaign-types'

type CampaignPreviewProps = {
  form: CampaignForm
  tab: CampaignTab
}

/** The storefront button in the campaign's look: theme-like dark, or the custom colours. */
function buttonStyle(form: CampaignForm): CSSProperties | undefined {
  if (form.buttonStyle !== 'custom') return undefined
  return {
    backgroundColor: form.buttonBackground,
    color: form.buttonTextColor,
    borderRadius: BUTTON_RADIUS_REM[form.buttonRadius],
  }
}

const SHOPPER = 'rounded-lg border border-border bg-white p-5 text-neutral-900 shadow-xs'

/**
 * The right column of the campaign editor, as Essential has it: the product page with the
 * sold-out button and Notify me (Notification settings, Button, Products), the pop-up and its
 * thank-you (Pop up), or the alert email (Email). Shopper-side, so it is drawn light.
 */
export default function CampaignPreview({ form, tab }: CampaignPreviewProps) {
  // Hooks
  const { campaign: copy } = useCopy(backInStockContent)

  // Render logic
  const w = notifyWidgetOf(form)
  const product = `${copy.sampleProduct} - ${copy.sampleVariant}`
  const notify = (
    <button
      type="button"
      tabIndex={-1}
      style={buttonStyle(form)}
      className="h-11 w-full rounded-md bg-neutral-900 text-body font-semibold text-white"
    >
      {w.buttonText}
    </button>
  )

  if (tab === 'email') {
    return (
      <div className={`${SHOPPER} flex flex-col items-center gap-4 text-center`}>
        <p className="self-start text-caption text-neutral-500">
          {copy.previewEmailSubject(product)}
        </p>
        <p className="text-xl font-semibold">{copy.previewStore}</p>
        <p className="text-lg font-semibold">{copy.previewEmailHeading}</p>
        <p className="text-body text-neutral-600">
          {copy.previewEmailBody(product, copy.previewStore)}
        </p>
        <span className="w-full rounded-md bg-neutral-900 py-3 text-body font-semibold text-white">
          {copy.previewEmailButton}
        </span>
        <p className="text-caption text-neutral-500 underline">{copy.previewEmailFooter}</p>
      </div>
    )
  }

  if (tab === 'popup') {
    return (
      <div className="flex flex-col gap-4">
        <div className={`${SHOPPER} flex flex-col gap-4`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-xl font-medium">{w.popupHeading}</p>
            <X className="size-5 text-neutral-500" />
          </div>
          <p className="text-body">
            {describeProduct(w.popupDescription, copy.sampleProduct, copy.sampleVariant)}
          </p>
          <span className="rounded-md border border-neutral-300 px-3 py-2.5 text-body text-neutral-400">
            {w.emailPlaceholder}
          </span>
          {w.newsletter ? (
            <span className="flex items-start gap-2 text-caption text-neutral-600">
              <span
                className={`mt-0.5 size-4 shrink-0 rounded-[0.1875rem] border border-neutral-400 ${w.newsletterPrechecked ? 'bg-neutral-900' : ''}`}
              />
              {w.newsletterText}
            </span>
          ) : null}
          <span className="rounded-md bg-neutral-900 py-3 text-center text-body font-semibold text-white">
            {w.submitText}
          </span>
          {w.disclaimer ? <p className="text-caption text-neutral-500">{w.disclaimer}</p> : null}
        </div>
        <p className="text-caption font-medium text-muted-foreground">{copy.previewThanks}</p>
        <div className={`${SHOPPER} flex flex-col gap-2`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-xl font-medium">{w.successHeading}</p>
            <X className="size-5 text-neutral-500" />
          </div>
          <p className="text-body">{w.successMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${SHOPPER} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1">
        <p className="text-xl font-semibold">{copy.sampleProduct}</p>
        <p className="text-lg">{copy.samplePrice}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-caption text-neutral-600">{copy.sampleSize}</p>
        <div className="flex gap-2">
          <span className="rounded-full border border-neutral-400 px-3 py-1 text-caption">
            {copy.sampleSmall}
          </span>
          <span className="rounded-full bg-neutral-900 px-3 py-1 text-caption text-white">
            {copy.sampleVariant}
          </span>
        </div>
      </div>
      <span className="flex h-11 w-full items-center justify-center rounded-md border border-neutral-900 text-body text-neutral-500">
        {copy.soldOut}
      </span>
      {form.display === 'popup' ? (
        notify
      ) : (
        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
          <span className="rounded-md border border-neutral-300 px-3 py-2.5 text-body text-neutral-400">
            {w.emailPlaceholder}
          </span>
          <span className="rounded-md bg-neutral-900 py-3 text-center text-body font-semibold text-white">
            {w.submitText}
          </span>
        </div>
      )}
    </div>
  )
}
