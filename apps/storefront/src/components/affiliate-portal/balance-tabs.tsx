'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { money } from '@/lib/portal-format'

type BalanceTabsProps = {
  totals: { pendingPaise: number; approvedPaise: number; paidPaise: number }
  /** What their next payout looks like, one line each. */
  outlook: string[]
  /** The Program details tab's content (`ProgramDetails`), drawn on the server. */
  program: ReactNode
  /** Settings › Payout and tax, while no UPI ID or bank account is saved: the footer's nudge. */
  payoutHref: string | null
}

const copy = affiliatePortalContent.dashboard
const hints = affiliateContent.dashboard.balances

/**
 * UpPromote's "Commission | Program details" card in shadcn's card style: the balance as Pending,
 * Approved and Paid rows with what each means; the footer (pinned to the bottom so it lines up
 * with the link card beside it) says what the next payout looks like and, while no payout
 * details are saved, offers to add them.
 */
export default function BalanceTabs({ totals, outlook, program, payoutHref }: BalanceTabsProps) {
  // Render logic
  const rows = [
    { label: copy.totals.pending, value: totals.pendingPaise, hint: hints.pendingHint },
    { label: copy.totals.approved, value: totals.approvedPaise, hint: hints.approvedHint },
    { label: copy.totals.paid, value: totals.paidPaise, hint: hints.paidHint },
  ]
  return (
    <Card>
      <Tabs defaultValue="balance" className="flex flex-1 flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle>{copy.tabs.commission}</CardTitle>
          <CardDescription>{copy.balanceHelp}</CardDescription>
          <CardAction>
            <TabsList>
              <TabsTrigger value="balance">{copy.tabs.commission}</TabsTrigger>
              <TabsTrigger value="program">{copy.tabs.program}</TabsTrigger>
            </TabsList>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TabsContent value="balance">
            <dl className="divide-y rounded-lg border">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex flex-col">
                    <dt className="text-sm font-medium">{r.label}</dt>
                    <dd className="text-xs text-muted-foreground">{r.hint}</dd>
                  </div>
                  <dd className="text-lg font-semibold tabular-nums">{money(r.value)}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>
          <TabsContent value="program">{program}</TabsContent>
        </CardContent>
        <CardFooter className="mt-auto min-h-20 flex-wrap justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
            {payoutHref ? (
              <>
                <span className="font-medium">{copy.banner.title}</span>
                <span className="text-muted-foreground">{copy.banner.body}</span>
              </>
            ) : (
              outlook.map((l) => (
                <span key={l} className="text-muted-foreground">
                  {l}
                </span>
              ))
            )}
          </div>
          {payoutHref ? (
            <Button size="sm" nativeButton={false} render={<Link href={payoutHref} />}>
              {copy.banner.action}
            </Button>
          ) : null}
        </CardFooter>
      </Tabs>
    </Card>
  )
}
