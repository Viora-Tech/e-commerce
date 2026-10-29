'use client'

import type { Gstr3b, Gstr3bPlaceRow } from '@commerce/invoices'
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
import NoticeBar from '@/components/layout/notice-bar'
import { gstReturnsContent } from '@/data/gst-invoices'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { CELL, HEAD } from './table-classes'

type Gstr3bCardProps = {
  report: Omit<Gstr3b, 'unregisteredInterState'> & {
    unregisteredInterState: (Gstr3bPlaceRow & { name: string })[]
  }
  /** The CSV and PDF downloads, in the card's header. */
  action: ReactNode
}

const ROWS = ['outwardTaxable', 'zeroRated', 'nilExempt'] as const

/** GSTR-3B Tables 3.1 and 3.2 laid out like the portal, to copy across figure by figure. */
export default function Gstr3bCard({ report, action }: Gstr3bCardProps) {
  // Hooks
  const copy = useCopy(gstReturnsContent)
  const locale = useLocale()

  // Helpers
  const money = (p: number) => formatPaise(p, locale)

  // Render logic
  const t = copy.gstr3b
  const g = copy.gstr1
  const num = `${CELL} text-right tabular-nums`

  return (
    <DataCard title={t.title} subtitle={t.subtitle} action={action} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={HEAD}>{t.nature}</TableHead>
            <TableHead className={`${HEAD} text-right`}>{g.taxable}</TableHead>
            <TableHead className={`${HEAD} text-right`}>{g.igst}</TableHead>
            <TableHead className={`${HEAD} text-right`}>{g.cgst}</TableHead>
            <TableHead className={`${HEAD} text-right`}>{g.sgst}</TableHead>
            <TableHead className={`${HEAD} text-right`}>{t.cess}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((key) => {
            const row = report[key]
            return (
              <TableRow key={key}>
                <TableCell className={`${CELL} whitespace-normal`}>{t.rows[key]}</TableCell>
                <TableCell className={num}>{money(row.taxablePaise)}</TableCell>
                <TableCell className={num}>{money(row.igstPaise)}</TableCell>
                <TableCell className={num}>{money(row.cgstPaise)}</TableCell>
                <TableCell className={num}>{money(row.sgstPaise)}</TableCell>
                <TableCell className={num}>{money(row.cessPaise)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <h3 className="px-5 pt-6 text-body font-medium">{t.interStateTitle}</h3>
      <p className="px-5 pb-2 text-caption text-muted-foreground">{t.interStateNote}</p>
      {report.unregisteredInterState.length === 0 ? (
        <p className="px-5 text-body text-muted-foreground">{t.noneInterState}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{t.placeOfSupply}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{g.taxable}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{g.igst}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.unregisteredInterState.map((p) => (
              <TableRow key={p.pos}>
                <TableCell className={CELL}>{`${p.pos}-${p.name}`}</TableCell>
                <TableCell className={num}>{money(p.taxablePaise)}</TableCell>
                <TableCell className={num}>{money(p.igstPaise)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="px-5 pt-4">
        <NoticeBar>{t.noItc}</NoticeBar>
      </div>
    </DataCard>
  )
}
