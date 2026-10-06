import { formatSignedMoney } from '@commerce/money'
import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { giftCardDetailContent } from '@/data/gift-cards'
import { formatPattern } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'

type Transaction = {
  id: string
  kind: 'issue' | 'debit' | 'refund' | 'adjustment'
  amountPaise: number
  balanceAfterPaise: number
  note: string | null
  author: string | null
  createdAt: Date | string
  orderId: string | null
  orderNumber: number | null
}

type HistoryCardProps = { transactions: Transaction[] }

const copy = giftCardDetailContent.history
const WHEN = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const

/** Every balance movement, newest first, with the order it came from and who made it. */
export default function HistoryCard({ transactions }: HistoryCardProps) {
  return (
    <Card gap={4} inset={5}>
      <p className="text-card-title text-foreground">{copy.heading}</p>
      <div className="-mx-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">{copy.columns.date}</TableHead>
              <TableHead>{copy.columns.activity}</TableHead>
              <TableHead className="text-right">{copy.columns.amount}</TableHead>
              <TableHead className="pr-5 text-right">{copy.columns.balance}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="pl-5 align-top text-muted-foreground tabular-nums">
                  {formatPattern(t.createdAt, WHEN)}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <span className="flex flex-col">
                    <span className="text-body text-foreground">
                      {copy.kind[t.kind]}
                      {t.orderId && t.orderNumber ? (
                        <>
                          {' · '}
                          <Link href={`/orders/${t.orderId}`} className="text-link hover:underline">
                            {copy.order(t.orderNumber)}
                          </Link>
                        </>
                      ) : null}
                    </span>
                    {t.note || t.author ? (
                      <span className="text-caption text-muted-foreground">
                        {[t.note, t.author ? copy.by(t.author) : null].filter(Boolean).join(' ')}
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right align-top tabular-nums',
                    t.amountPaise < 0 ? 'text-foreground' : 'text-success',
                  )}
                >
                  {formatSignedMoney(t.amountPaise)}
                </TableCell>
                <TableCell className="pr-5 text-right align-top tabular-nums">
                  {formatPaise(t.balanceAfterPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
