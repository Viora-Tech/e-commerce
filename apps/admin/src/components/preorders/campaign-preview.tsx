'use client'

import {
  campaignColours,
  computeDeposit,
  preorderNoteText,
  preorderUnitPrice,
} from '@commerce/core/preorder'
import { formatInZone } from '@commerce/dates'
import type { CSSProperties } from 'react'
import { preordersContent } from '@/data/preorders'
import { rupees } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import type { CampaignFormState } from './campaign-form-state'

type CampaignPreviewProps = {
  form: CampaignFormState
}

/** A sample price the preview shows the discount and deposit on. */
const SAMPLE_PRICE_PAISE = 499_900
const DAY_MS = 24 * 60 * 60 * 1000

/** The ship date the form describes: its date, else today plus "ships in N days". */
function shipDateOf(form: CampaignFormState): Date | null {
  if (form.shipDate) return new Date(`${form.shipDate}T00:00:00`)
  const days = Number(form.shipsInDays)
  if (form.shipsInDays.trim() && Number.isInteger(days) && days >= 0) {
    return new Date(Date.now() + days * DAY_MS)
  }
  return null
}

/** A campaign note with the ship date filled in, as the storefront prints it. */
const noteFor = (text: string, shipDate: Date | null) =>
  preorderNoteText({ productNote: text, storeNote: null, shipDate })

/** The campaign's discount as the rules read it, from what is typed. */
function discountOf(form: CampaignFormState) {
  const value =
    form.discountType === 'fixed'
      ? rupees.toPaise(form.discountValue)
      : Number(form.discountValue) || null
  return { discountType: form.discountType, discountValue: value }
}

/**
 * Live preview beside the Content and Design tabs (#144): the product page's badge, price,
 * button and note; a cart line; and the note kept on the order. Same rules as the storefront.
 */
export default function CampaignPreview({ form }: CampaignPreviewProps) {
  // Hooks
  const { look: copy } = useCopy(preordersContent)

  // Render logic
  const colours = campaignColours(form.design)
  const shipDate = shipDateOf(form)
  const price = preorderUnitPrice(SAMPLE_PRICE_PAISE, discountOf(form))
  const percent = Number(form.depositPercent)
  const deposit =
    form.paymentMode === 'fixed'
      ? computeDeposit(price, 'fixed', { depositPaise: rupees.toPaise(form.deposit) })
      : form.paymentMode === 'percentage' && percent > 0
        ? computeDeposit(price, 'percentage', { depositPercent: percent })
        : null
  const buttonStyle = {
    ...(colours.buttonBackground
      ? { backgroundColor: colours.buttonBackground, borderColor: colours.buttonBackground }
      : {}),
    ...(colours.buttonText ? { color: colours.buttonText } : {}),
  } satisfies CSSProperties
  const badgeStyle = {
    ...(colours.badgeBackground ? { backgroundColor: colours.badgeBackground } : {}),
    ...(colours.badgeText ? { color: colours.badgeText } : {}),
  } satisfies CSSProperties
  const badge = form.content.badgeText.trim() || copy.previewDefaultBadge
  const productNote = noteFor(form.content.productNote, shipDate)
  const cartNote = noteFor(form.content.cartLineText, shipDate)
  const orderNote = noteFor(form.content.orderNote, shipDate)

  return (
    <aside aria-label={copy.preview} className="flex flex-col gap-3">
      <span className="text-caption font-medium text-muted-foreground">{copy.preview}</span>

      <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <span className="text-caption text-muted-foreground">{copy.previewProduct}</span>
        <span
          className="self-start rounded-md bg-muted px-2 py-0.5 text-caption font-medium"
          style={badgeStyle}
        >
          {badge}
        </span>
        <span className="text-body-strong">{copy.previewTitle}</span>
        <span className="flex items-baseline gap-2 tabular-nums">
          <span className="text-body-strong">{formatPaise(price)}</span>
          {price !== SAMPLE_PRICE_PAISE ? (
            <span className="text-caption text-muted-foreground line-through">
              {formatPaise(SAMPLE_PRICE_PAISE)}
            </span>
          ) : null}
        </span>
        {shipDate ? (
          <span className="text-caption text-muted-foreground">
            {copy.previewShips(formatInZone(shipDate, { dateStyle: 'medium' }))}
          </span>
        ) : null}
        {deposit && deposit.balancePaise > 0 ? (
          <span className="text-caption text-muted-foreground">
            {copy.previewDeposit(formatPaise(deposit.depositPaise), formatPaise(deposit.balancePaise))}
          </span>
        ) : null}
        <span
          className="flex h-9 items-center justify-center rounded-md border border-primary bg-primary px-3 text-body font-medium text-primary-foreground"
          style={buttonStyle}
        >
          {form.content.buttonText.trim() || copy.previewDefaultButton}
        </span>
        {productNote ? <span className="text-caption">{productNote}</span> : null}
      </section>

      <section className="flex flex-col gap-1 rounded-lg border border-border p-3">
        <span className="text-caption text-muted-foreground">{copy.previewCart}</span>
        <span className="flex items-center justify-between gap-2">
          <span className="text-body">{copy.previewTitle}</span>
          <span className="text-body tabular-nums">{formatPaise(price)}</span>
        </span>
        <span
          className="self-start rounded-md bg-muted px-2 py-0.5 text-caption font-medium"
          style={badgeStyle}
        >
          {badge}
        </span>
        {cartNote ? <span className="text-caption text-muted-foreground">{cartNote}</span> : null}
      </section>

      <section className="flex flex-col gap-1 rounded-lg border border-border p-3">
        <span className="text-caption text-muted-foreground">{copy.previewOrder}</span>
        <span className="text-body">{copy.previewTitle}</span>
        {orderNote ? <span className="text-caption text-muted-foreground">{orderNote}</span> : null}
      </section>
    </aside>
  )
}
