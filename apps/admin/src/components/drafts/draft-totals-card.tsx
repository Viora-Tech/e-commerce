'use client'

import { BadgePercent, Pencil, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { useState } from 'react'
import DraftDiscountDialog from '@/components/drafts/draft-discount-dialog'
import type { DraftCodeCheck, DraftFormState } from '@/components/drafts/draft-form-state'
import { draftTotals } from '@/components/drafts/draft-form-state'
import DraftShippingDialog from '@/components/drafts/draft-shipping-dialog'
import { useDraftCodeCheck } from '@/components/drafts/use-draft-code-check'
import { type DraftGst, useDraftGst } from '@/components/drafts/use-draft-gst'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'

type DraftTotalsCardProps = {
  form: DraftFormState
  /** GST already inside a saved draft's prices, shown until the live estimate answers. */
  tax: DraftGst | null
  /** The saved draft's code as last applied, shown until the live re-check answers. */
  savedCheck: DraftCodeCheck | null
  onChange: (patch: Partial<DraftFormState>) => void
}

/**
 * The bill (Figma "Payment", audit #29/#30): subtotal, then the discount and shipping as lines
 * with edit and remove (or "Add discount" / "Add shipping" links that open small dialogs), the
 * GST inside the prices, and the total.
 */
export default function DraftTotalsCard({ form, tax, savedCheck, onChange }: DraftTotalsCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)
  const fmt = useFormat()
  const { check, apply } = useDraftCodeCheck(form, savedCheck)
  const [editing, setEditing] = useState<'discount' | 'shipping' | null>(null)
  const gst = useDraftGst(form, draftTotals(form, check), tax)

  // Render logic
  const totals = draftTotals(form, check)
  const t = copy.totals
  const itemCount = form.lines.reduce((sum, l) => sum + l.quantity, 0)
  const coded = form.discountCode && check?.ok ? check : null
  const stale = form.discountCode && check && !check.ok ? t.code.rejected[check.reason] : null
  const hasDiscount = Boolean(form.discountCode) || form.discountPaise > 0
  const discountNote = form.discountCode
    ? [form.discountCode.toUpperCase(), coded?.label].filter(Boolean).join(' · ')
    : form.discountLabel
  const waived = form.shippingPaise - totals.shippingPaise

  return (
    <DataCard title={t.heading} bodyClassName="flex flex-col gap-3">
      <Row label={t.subtotal} note={t.items(itemCount)} amount={fmt.money(totals.subtotalPaise)} />
      {hasDiscount ? (
        <Row
          label={t.discount}
          note={discountNote}
          icon={form.discountCode ? <BadgePercent aria-hidden="true" className="size-4" /> : null}
          amount={`−${fmt.money(totals.discountPaise)}`}
          onEdit={() => setEditing('discount')}
          onRemove={() => onChange({ discountCode: '', discountPaise: 0, discountLabel: '' })}
          editLabel={t.edit(t.discount)}
          removeLabel={t.remove(t.discount)}
        />
      ) : (
        <AddLink label={t.addDiscount} onClick={() => setEditing('discount')} />
      )}
      {stale ? (
        <p className="-mt-2 text-caption text-destructive">
          {t.code.stale} {stale}
        </p>
      ) : null}
      {form.shippingPaise > 0 ? (
        <Row
          label={t.shipping}
          amount={fmt.money(form.shippingPaise)}
          onEdit={() => setEditing('shipping')}
          onRemove={() => onChange({ shippingPaise: 0 })}
          editLabel={t.edit(t.shipping)}
          removeLabel={t.remove(t.shipping)}
        />
      ) : (
        <AddLink label={t.addShipping} onClick={() => setEditing('shipping')} />
      )}
      {waived > 0 ? (
        <Row label={t.code.freeShipping} amount={`−${fmt.money(waived)}`} muted />
      ) : null}
      {gst && gst.taxPaise > 0 ? (
        <Row
          label={t.gstEstimated(gst.ratePercent)}
          note={t.gstIncluded}
          amount={fmt.money(gst.taxPaise)}
          muted
        />
      ) : null}
      <div className="flex items-center justify-between border-line border-t pt-3 text-body font-semibold text-ink-strong">
        <p>{t.total}</p>
        <p className="tabular-nums">{fmt.money(totals.totalPaise)}</p>
      </div>
      <DraftDiscountDialog
        open={editing === 'discount'}
        onOpenChange={(open) => setEditing(open ? 'discount' : null)}
        form={form}
        onCheckCode={apply}
        onChange={onChange}
      />
      <DraftShippingDialog
        open={editing === 'shipping'}
        onOpenChange={(open) => setEditing(open ? 'shipping' : null)}
        shippingPaise={form.shippingPaise}
        onApply={(shippingPaise) => onChange({ shippingPaise })}
      />
    </DataCard>
  )
}

/** One line of the bill: a label with an optional note, the amount, and edit/remove buttons. */
function Row({
  label,
  note,
  icon,
  amount,
  muted = false,
  onEdit,
  onRemove,
  editLabel,
  removeLabel,
}: {
  label: string
  note?: string | null | undefined
  icon?: ReactNode
  amount: string
  muted?: boolean
  onEdit?: () => void
  onRemove?: () => void
  editLabel?: string
  removeLabel?: string
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 text-body">
      <p className="flex min-w-0 items-baseline gap-2">
        <span className={muted ? 'text-muted-foreground' : 'text-foreground'}>{label}</span>
        {note ? (
          <span className="flex min-w-0 items-center gap-1 truncate text-caption text-muted-foreground">
            {icon}
            {note}
          </span>
        ) : null}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <p className={muted ? 'text-muted-foreground tabular-nums' : 'tabular-nums'}>{amount}</p>
        {onEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={editLabel}
            title={editLabel}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" />
          </Button>
        ) : null}
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={removeLabel}
            title={removeLabel}
            onClick={onRemove}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** "Add discount" / "Add shipping": a quiet link that opens its dialog. */
function AddLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex min-h-8 items-center">
      <Button variant="link" size="sm" className="h-auto px-0" onClick={onClick}>
        {label}
      </Button>
    </div>
  )
}
