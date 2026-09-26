'use client'

import type { LineEligibility, ReturnReason } from '@commerce/core/returns'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { returnReasonLabels, returnsContent } from '@/data/returns'
import { submitReturnAction } from '@/lib/return-actions'
import ReturnPhotos from './return-photos'

export type ReturnFormLine = {
  id: string
  title: string
  variantTitle: string | null
  imageUrl: string | null
  returnable: number
  why: LineEligibility['why']
}

type ReturnFormProps = {
  orderNumber: number
  closesLabel: string
  lines: ReturnFormLine[]
  reasons: ReturnReason[]
}

const copy = returnsContent.form

/** The shopper's return request: items and how many, a reason, a note and photos. */
export default function ReturnForm({ orderNumber, closesLabel, lines, reasons }: ReturnFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<ReturnReason | null>(null)
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleToggle = (line: ReturnFormLine, on: boolean) =>
    setQty((q) => ({ ...q, [line.id]: on ? line.returnable : 0 }))

  const handleQty = (id: string, value: number) => setQty((q) => ({ ...q, [id]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const picked = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([orderLineId, quantity]) => ({ orderLineId, quantity }))
    if (picked.length === 0) return setError(copy.errors.noItems)
    if (!reason) return setError(copy.errors.noReason)
    setError(null)
    start(async () => {
      const r = await submitReturnAction({ orderNumber, lines: picked, reason, note, photos })
      if (r?.error) setError(r.error)
    })
  }

  // Render logic
  const card = 'flex flex-col gap-4 rounded-2xl border border-line p-5 sm:p-6'

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[40rem] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/account/orders/${orderNumber}`}
          className="text-small text-muted hover:text-ink"
        >
          ← {copy.back}
        </Link>
        <h2 className="h3">{copy.title(orderNumber)}</h2>
        <p className="text-body text-muted">{copy.intro(closesLabel)}</p>
      </div>

      <fieldset className={card}>
        <legend className="sr-only">{copy.itemsHeading}</legend>
        <h3 className="h4">{copy.itemsHeading}</h3>
        <ul className="flex flex-col divide-y divide-line">
          {lines.map((l) => {
            const n = qty[l.id] ?? 0
            const can = l.returnable > 0
            return (
              <li key={l.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <input
                  type="checkbox"
                  className="size-5 shrink-0"
                  checked={n > 0}
                  disabled={!can || pending}
                  onChange={(e) => handleToggle(l, e.target.checked)}
                  aria-label={l.title}
                />
                <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                  {l.imageUrl ? (
                    // biome-ignore lint/performance/noImgElement: product media is on the store's CDN.
                    <img src={l.imageUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-body font-medium">{l.title}</span>
                  {l.variantTitle ? (
                    <span className="text-small text-muted">{l.variantTitle}</span>
                  ) : null}
                  {!can && l.why !== 'ok' ? (
                    <span className="text-small text-muted">{copy.notReturnable[l.why]}</span>
                  ) : null}
                </div>
                {can && l.returnable > 1 && n > 0 ? (
                  <label className="flex flex-col items-end gap-1">
                    <span className="text-small text-muted">{copy.quantity}</span>
                    <select
                      className="field__input w-[4.5rem]"
                      value={n}
                      disabled={pending}
                      onChange={(e) => handleQty(l.id, Number(e.target.value))}
                    >
                      {Array.from({ length: l.returnable }, (_, i) => i + 1).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </li>
            )
          })}
        </ul>
      </fieldset>

      <fieldset className={card}>
        <legend className="sr-only">{copy.reasonHeading}</legend>
        <h3 className="h4">{copy.reasonHeading}</h3>
        <div className="flex flex-col gap-3">
          {reasons.map((r) => (
            <label key={r} className="flex items-center gap-3 text-body">
              <input
                type="radio"
                name="reason"
                className="size-5 shrink-0"
                checked={reason === r}
                disabled={pending}
                onChange={() => setReason(r)}
              />
              {returnReasonLabels[r]}
            </label>
          ))}
        </div>
        <label className="field">
          <span className="field__label text-small">{copy.noteLabel}</span>
          <textarea
            className="field__input min-h-[6rem]"
            rows={4}
            maxLength={1000}
            value={note}
            placeholder={copy.notePlaceholder}
            disabled={pending}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="text-small text-muted">{copy.exchangeNote}</span>
        </label>
      </fieldset>

      <div className={card}>
        <ReturnPhotos photos={photos} onChange={setPhotos} disabled={pending} />
      </div>

      {error ? (
        <p className="text-body text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className={`btn btn--primary w-full sm:w-auto sm:self-start${pending ? ' is-loading' : ''}`}
        disabled={pending}
      >
        <span className="btn__label">{pending ? copy.submitting : copy.submit}</span>
      </button>
    </form>
  )
}
