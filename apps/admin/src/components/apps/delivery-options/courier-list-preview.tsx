'use client'

import { courierId } from '@commerce/core/delivery-options'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import CheckoutPreviewList from './checkout-preview-list'
import type { CourierRow } from './courier-rows'
import {
  PREVIEW_CART,
  PREVIEW_PIN,
  type PreviewDraft,
  useCheckoutPreview,
} from './use-checkout-preview'

type CourierListPreviewProps = {
  /** The page's unsaved layout and options, priced instead of what is saved. */
  draft: PreviewDraft
  /** The courier list's rows, for names and the hidden / switched-off line. */
  rows: CourierRow[]
  isOn: (id: string) => boolean
  /** The list option picks the fastest courier (else the cheapest). */
  fastest: boolean
}

/** "2.5" → 2500 g; anything else → 0 (asks nothing). */
function gramsOf(kg: string): number {
  const n = Number(kg.trim())
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 1000) : 0
}

/**
 * Options → Courier list: "Checkout preview" for a sample shopper whose PIN and cart weight the
 * admin can change, with which courier the price includes for that sample, said in words
 * ("Cheapest for PIN 560038 · 2 kg: Blue Dart Surface (included)", #1781 item 7).
 */
export default function CourierListPreview({
  draft,
  rows,
  isOn,
  fastest,
}: CourierListPreviewProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const [pin, setPin] = useState(PREVIEW_PIN)
  const [kg, setKg] = useState(String(PREVIEW_CART.weightGrams / 1000))
  const preview = useCheckoutPreview(draft, pin, true, gramsOf(kg))

  // Helpers
  const nameOf = (id: string) => {
    const row = rows.find((r) => r.id === id)
    return row ? `${row.carrier} ${pages.routeTable.speeds[row.speed]}` : id
  }

  // Render logic
  const p = pages.preview
  const grams = gramsOf(kg)
  const ready = /^\d{6}$/.test(pin) && grams > 0
  const allIds = rows.map((r) => r.id)
  const first = preview.result?.options[0]
  const pick = first?.pick?.route
  const includedId = pick ? courierId(pick.carrierKey, pick.speed) : null
  const shownIds = new Set(
    (first?.choices ?? []).map((c) => courierId(c.route.carrierKey, c.route.speed)),
  )
  const off = allIds.filter((id) => !isOn(id)).map(nameOf)
  const hidden = preview.result
    ? allIds.filter((id) => isOn(id) && !shownIds.has(id) && id !== includedId).map(nameOf)
    : []

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-panel-border bg-card p-4 lg:sticky lg:top-4">
      <h2 className="text-card-title text-ink-strong">{p.previewTitle}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="preview-pin">{p.samplePin}</FieldLabel>
          <Input
            id="preview-pin"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="preview-kg">{p.sampleKg}</FieldLabel>
          <Input
            id="preview-kg"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
        </Field>
        <FieldDescription className="col-span-2">{p.sampleHelp}</FieldDescription>
      </div>
      {ready ? (
        <>
          {includedId ? (
            <p className="text-body font-medium text-ink-strong">
              {p.pickLine(fastest, pin, String(grams / 1000), nameOf(includedId))}
            </p>
          ) : null}
          <CheckoutPreviewList {...preview} look="logos" />
        </>
      ) : (
        <p className="text-caption text-muted-foreground">{p.pinInvalid}</p>
      )}
      {ready && (hidden.length || off.length) ? (
        <p className="text-caption text-muted-foreground">
          {[
            hidden.length ? p.hidden(hidden.join(', ')) : null,
            off.length ? p.off(off.join(', ')) : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      ) : null}
    </section>
  )
}
