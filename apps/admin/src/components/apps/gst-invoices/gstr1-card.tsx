'use client'

import type { Gstr1DocDet, Gstr1Totals } from '@commerce/invoices'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import { gstReturnsContent } from '@/data/gst-invoices'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { CELL, HEAD } from './table-classes'

type Gstr1CardProps = {
  totals: readonly Gstr1Totals[]
  documents: readonly Gstr1DocDet[]
  /** The download buttons, in the card's header. */
  action: ReactNode
}

/** GSTR-1 at a glance: each table's documents and amounts, and Table 13's series. */
export default function Gstr1Card({ totals, documents, action }: Gstr1CardProps) {
  // Hooks
  const copy = useCopy(gstReturnsContent)
  const locale = useLocale()

  // Helpers
  const money = (p: number) => formatPaise(p, locale)

  // Render logic
  const g = copy.gstr1
  const num = `${CELL} text-right tabular-nums`

  return (
    <DataCard title={g.title} action={action} flush>
      {totals.length === 0 ? (
        <p className="px-5 text-body text-muted-foreground">{g.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{g.table}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{g.documents}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{g.taxable}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{g.igst}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{g.cgst}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{g.sgst}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.map((t) => (
              <TableRow key={t.table}>
                <TableCell className={CELL}>{g.tables[t.table] ?? t.table}</TableCell>
                <TableCell className={num}>{t.documents}</TableCell>
                <TableCell className={num}>{money(t.taxablePaise)}</TableCell>
                <TableCell className={num}>{money(t.igstPaise)}</TableCell>
                <TableCell className={num}>{money(t.cgstPaise)}</TableCell>
                <TableCell className={num}>{money(t.sgstPaise)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {documents.length > 0 ? (
        <>
          <h3 className="px-5 pt-6 pb-2 text-body font-medium">{g.docsTitle}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={HEAD}>{g.table}</TableHead>
                <TableHead className={HEAD}>{g.from}</TableHead>
                <TableHead className={HEAD}>{g.to}</TableHead>
                <TableHead className={`${HEAD} text-right`}>{g.total}</TableHead>
                <TableHead className={`${HEAD} text-right`}>{g.cancelled}</TableHead>
                <TableHead className={`${HEAD} text-right`}>{g.net}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.flatMap((d) =>
                d.docs.map((x) => (
                  <TableRow key={`${d.doc_num}-${x.num}`}>
                    <TableCell className={CELL}>{g.docTypes[d.doc_num] ?? d.doc_num}</TableCell>
                    <TableCell className={CELL}>{x.from}</TableCell>
                    <TableCell className={CELL}>{x.to}</TableCell>
                    <TableCell className={num}>{x.totnum}</TableCell>
                    <TableCell className={num}>{x.cancel}</TableCell>
                    <TableCell className={num}>{x.net_issue}</TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
        </>
      ) : null}
    </DataCard>
  )
}
