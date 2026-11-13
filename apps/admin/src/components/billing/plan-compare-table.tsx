'use client'

import { PLAN_QUOTAS } from '@commerce/ai/client'
import { PLAN_IDS, PLANS, type PlanId } from '@commerce/core/billing'
import { CheckIcon, MinusIcon } from '@commerce/ui/icons'
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
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { feePercent } from '@/lib/billing'

/** Figma 931:10521 "Compare everything": every plan limit and feature, one row each. */
export default function PlanCompareTable() {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()

  // Helpers
  const tick = (on: boolean) =>
    on ? (
      <CheckIcon className="size-4 text-success" aria-label={copy.compareYes} />
    ) : (
      <MinusIcon className="size-4 text-muted-foreground" aria-label={copy.compareNo} />
    )

  // Render logic
  const d = copy.dialog
  const rows: { id: string; label: string; cell: (p: PlanId) => ReactNode }[] = [
    { id: 'orders', label: d.rows.orders, cell: (p) => format.number(PLANS[p].orders) },
    {
      id: 'fee',
      label: d.rows.fee,
      cell: (p) =>
        PLANS[p].feeBasisPoints > 0 ? `${feePercent(PLANS[p].feeBasisPoints)}%` : d.noFee,
    },
    { id: 'staff', label: d.rows.staff, cell: (p) => format.number(PLANS[p].staff) },
    {
      id: 'ai',
      label: d.rows.ai,
      cell: (p) => format.number(PLAN_QUOTAS[PLANS[p].ai].credits),
    },
    { id: 'theme', label: d.rows.shopifyTheme, cell: (p) => tick(PLANS[p].features.shopifyTheme) },
    { id: 'mcp', label: d.rows.mcpApi, cell: (p) => tick(PLANS[p].features.mcpApi) },
    { id: 'loc', label: d.rows.multiLocation, cell: (p) => tick(PLANS[p].features.multiLocation) },
    { id: 'support', label: d.rows.support, cell: (p) => d.support[PLANS[p].features.support] },
    {
      id: 'storage',
      label: d.rows.storage,
      cell: (p) => copy.usage.gb(String(PLANS[p].storageGb)),
    },
    {
      id: 'visits',
      label: d.rows.visits,
      cell: (p) => {
        const visits = PLANS[p].visitsPerMonth
        return visits === null ? d.fairUse : format.number(visits)
      },
    },
    {
      id: 'apps',
      label: d.rows.apps,
      cell: (p) => (PLANS[p].features.allApps ? d.apps.all : d.apps.core),
    },
  ]

  return (
    <DataCard title={copy.changePlan.compareHeading} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5" />
            {PLAN_IDS.map((p) => (
              <TableHead key={p} className="text-caption uppercase">
                {copy.plans[p].name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="pl-5 text-ink-strong">{r.label}</TableCell>
              {PLAN_IDS.map((p) => (
                <TableCell key={p} className="tabular-nums">
                  {r.cell(p)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}
