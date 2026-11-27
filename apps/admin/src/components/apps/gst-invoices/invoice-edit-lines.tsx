'use client'

import type { DocumentSnapshot } from '@commerce/invoices'
import { FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import MoneyInput from '@/components/fields/money-input'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { type EditForm, paiseOf, quantityOf } from './invoice-edit-form'
import { CELL, HEAD } from './table-classes'

type InvoiceEditLinesProps = {
  snapshot: DocumentSnapshot
  form: EditForm
  onChange: (patch: Partial<EditForm>) => void
}

const NUM = 'text-right tabular-nums'

/** The sheet's Items table (quantity, unit price, discount per line) and its charges. */
export default function InvoiceEditLines({ snapshot, form, onChange }: InvoiceEditLinesProps) {
  // Hooks
  const copy = useCopy(gstInvoiceEditContent.sheet)

  // Helpers
  const setLine = (i: number, key: keyof EditForm['lines'][number], value: string) =>
    onChange({ lines: form.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) })
  const setCharge = (i: number, value: string) =>
    onChange({ charges: form.charges.map((c, j) => (j === i ? value : c)) })
  const lineTotal = (l: EditForm['lines'][number]) => {
    const q = quantityOf(l.quantity)
    const p = paiseOf(l.unitPrice)
    const d = paiseOf(l.discount)
    return q === null || p === null || d === null ? null : q * p - d
  }

  // Render logic
  const goods = snapshot.lines.filter((l) => !l.charge)
  const charges = snapshot.lines.filter((l) => l.charge)

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-body font-medium">{copy.items}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{copy.item}</TableHead>
              <TableHead className={`${HEAD} w-24`}>{copy.quantity}</TableHead>
              <TableHead className={`${HEAD} w-36`}>{copy.unitPrice}</TableHead>
              <TableHead className={`${HEAD} w-36`}>{copy.discount}</TableHead>
              <TableHead className={`${HEAD} ${NUM}`}>{copy.lineTotal}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goods.map((g, i) => {
              const l = form.lines[i]
              if (!l) return null
              const total = lineTotal(l)
              return (
                <TableRow key={g.orderLineId ?? `${g.description}-${i}`}>
                  <TableCell className={CELL}>
                    <span className="flex flex-col">
                      <span>{g.description}</span>
                      <span className="text-caption text-muted-foreground">
                        {g.hsn} · {g.ratePercent}%
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className={CELL}>
                    <Input
                      inputMode="numeric"
                      aria-label={`${copy.quantity}: ${g.description}`}
                      value={l.quantity}
                      aria-invalid={quantityOf(l.quantity) === null ? true : undefined}
                      onChange={(e) => setLine(i, 'quantity', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className={CELL}>
                    <MoneyInput
                      aria-label={`${copy.unitPrice}: ${g.description}`}
                      value={l.unitPrice}
                      invalid={paiseOf(l.unitPrice) === null}
                      onChange={(v) => setLine(i, 'unitPrice', v)}
                    />
                  </TableCell>
                  <TableCell className={CELL}>
                    <MoneyInput
                      aria-label={`${copy.discount}: ${g.description}`}
                      value={l.discount}
                      invalid={paiseOf(l.discount) === null || (total !== null && total < 0)}
                      onChange={(v) => setLine(i, 'discount', v)}
                    />
                  </TableCell>
                  <TableCell className={`${CELL} ${NUM}`}>
                    {total === null ? '-' : formatPaise(total)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="text-caption text-muted-foreground">{copy.removeHint}</p>
      </section>
      {charges.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-body font-medium">{copy.charges}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {charges.map((c, i) => (
              <div key={c.description} className="flex flex-col gap-1.5">
                <FieldLabel htmlFor={`edit-charge-${i}`}>{c.description}</FieldLabel>
                <MoneyInput
                  id={`edit-charge-${i}`}
                  value={form.charges[i] ?? ''}
                  invalid={paiseOf(form.charges[i] ?? '') === null}
                  onChange={(v) => setCharge(i, v)}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
