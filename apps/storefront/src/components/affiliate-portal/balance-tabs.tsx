'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
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
}

const copy = affiliatePortalContent.dashboard
const hints = affiliateContent.dashboard.balances

/**
 * UpPromote's "Commission | Program details" card in shadcn's plain card style: the balance as
 * Pending, Approved and Paid rows with what each means, then the next payout; or the rules.
 */
export default function BalanceTabs({ totals, outlook, program }: BalanceTabsProps) {
  // Render logic
  const rows = [
    { label: copy.totals.pending, value: totals.pendingPaise, hint: hints.pendingHint },
    { label: copy.totals.approved, value: totals.approvedPaise, hint: hints.approvedHint },
    { label: copy.totals.paid, value: totals.paidPaise, hint: hints.paidHint },
  ]
  return (
    <Card>
      <Tabs defaultValue="balance" className="gap-0">
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
        <CardContent className="pt-4">
          <TabsContent value="balance" className="flex flex-col gap-4">
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
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {outlook.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="program">{program}</TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
