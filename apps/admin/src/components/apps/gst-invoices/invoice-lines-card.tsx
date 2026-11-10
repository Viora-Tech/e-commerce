'use client'

import type { DocumentSnapshot, Party } from '@commerce/invoices'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import SettingsCard from '@/components/settings/settings-card'
import { gstInvoiceLinesContent as copy } from '@/data/gst-invoice-lines'
import { formatPaise } from '@/lib/money'
import { CELL, HEAD } from './table-classes'

type InvoiceLinesCardProps = {
  snapshot: DocumentSnapshot
}

const NUM = 'text-right tabular-nums'

function PartyBlock({ label, party }: { label: string; party: Party }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-body font-medium">{party.name}</p>
      {party.address.map((line) => (
        <p key={line} className="text-body text-muted-foreground">
          {line}
        </p>
      ))}
      {party.phone ? <p className="text-body text-muted-foreground">{party.phone}</p> : null}
      {party.gstin ? <p className="text-body">{copy.gstin(party.gstin)}</p> : null}
    </div>
  )
}

/**
 * What the invoice bills, as printed: bill-to / ship-to, each line with its HSN, GST rate,
 * taxable value and tax, then the CGST/SGST (or IGST) and invoice totals. Read from the
 * document's snapshot, so it always matches the PDF.
 */
export default function InvoiceLinesCard({ snapshot: s }: InvoiceLinesCardProps) {
  // Render logic
  const taxOf = (l: DocumentSnapshot['lines'][number]) => l.cgstPaise + l.sgstPaise + l.igstPaise
  const t = s.totals
  const totals: { label: string; value: number }[] = [
    { label: copy.taxable, value: t.taxablePaise },
    ...(s.interState
      ? [{ label: copy.igst, value: t.igstPaise }]
      : [
          { label: copy.cgst, value: t.cgstPaise },
          { label: copy.sgst, value: t.sgstPaise },
        ]),
    { label: copy.totalTax, value: t.taxPaise },
  ]

  return (
    <SettingsCard title={copy.title}>
      <div className="grid gap-4 sm:grid-cols-2">
        <PartyBlock label={copy.billTo} party={s.buyer} />
        {s.shipTo ? <PartyBlock label={copy.shipTo} party={s.shipTo} /> : null}
      </div>
      {s.placeOfSupply ? (
        <p className="mt-2 text-caption text-muted-foreground">
          {copy.placeOfSupply(s.placeOfSupply.name)}
        </p>
      ) : null}
      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{copy.item}</TableHead>
              <TableHead className={HEAD}>{copy.hsn}</TableHead>
              <TableHead className={`${HEAD} ${NUM}`}>{copy.qty}</TableHead>
              <TableHead className={`${HEAD} ${NUM}`}>{copy.rate}</TableHead>
              <TableHead className={`${HEAD} ${NUM}`}>{copy.taxable}</TableHead>
              <TableHead className={`${HEAD} ${NUM}`}>{copy.tax}</TableHead>
              <TableHead className={`${HEAD} ${NUM}`}>{copy.total}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.lines.map((l, i) => (
              <TableRow key={l.orderLineId ?? `${l.description}-${i}`}>
                <TableCell className={CELL}>
                  <span className="block max-w-[22rem] truncate">{l.description}</span>
                  {l.sku ? (
                    <span className="block text-caption text-muted-foreground">
                      {copy.sku(l.sku)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className={`${CELL} tabular-nums`}>
                  {l.hsn || <span className="text-muted-foreground">{copy.noHsn}</span>}
                </TableCell>
                <TableCell className={`${CELL} ${NUM}`}>{l.quantity}</TableCell>
                <TableCell className={`${CELL} ${NUM}`}>{l.ratePercent}%</TableCell>
                <TableCell className={`${CELL} ${NUM}`}>{formatPaise(l.taxablePaise)}</TableCell>
                <TableCell className={`${CELL} ${NUM}`}>{formatPaise(taxOf(l))}</TableCell>
                <TableCell className={`${CELL} ${NUM}`}>{formatPaise(l.totalPaise)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <dl className="mt-4 ml-auto flex w-full max-w-[20rem] flex-col gap-1.5">
        {t.discountPaise > 0 ? (
          <div className="flex justify-between text-body">
            <dt className="text-muted-foreground">{copy.discount}</dt>
            <dd className="tabular-nums">−{formatPaise(t.discountPaise)}</dd>
          </div>
        ) : null}
        {totals.map((row) => (
          <div key={row.label} className="flex justify-between text-body">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">{formatPaise(row.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-line pt-1.5 text-body font-medium">
          <dt>{copy.invoiceTotal}</dt>
          <dd className="tabular-nums">{formatPaise(t.totalPaise)}</dd>
        </div>
      </dl>
    </SettingsCard>
  )
}
