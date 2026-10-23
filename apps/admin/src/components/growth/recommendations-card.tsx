'use client'

import type { GrowthRecommendation } from '@commerce/core/marketing'
import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { growthRecommendationsContent } from '@/data/growth-report'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { routes } from '@/lib/routes'

type RecommendationsCardProps = { initial: GrowthRecommendation[] }

type Copy = typeof growthRecommendationsContent

/** The reason line, with the rule's own numbers in it. */
function reasonOf(r: GrowthRecommendation, copy: Copy, fmt: Formatters): string {
  const n = (key: string) => r.numbers[key] ?? 0
  const c = copy.cards
  switch (r.id) {
    case 'abandoned_checkout':
      return c.abandoned_checkout.reason(fmt.number(n('carts')), fmt.money(n('valuePaise')))
    case 'cod_confirmation':
      return c.cod_confirmation.reason(
        fmt.number(n('cod')),
        fmt.number(n('total')),
        formatRate(n('share')),
      )
    case 'win_back':
      return c.win_back.reason(fmt.number(n('customers')))
    case 'welcome':
      return c.welcome.reason(fmt.number(n('last30')), fmt.number(n('previous30')))
    case 'campaign':
      return c.campaign.reason(
        fmt.number(n('subscribers')),
        n('days') < 0 ? null : fmt.number(n('days')),
      )
    case 'links_no_orders':
      return c.links_no_orders.reason(r.name ?? '', fmt.number(n('clicks')))
  }
}

function actionLabel(r: GrowthRecommendation, copy: Copy): string {
  if (r.action.kind === 'create_automation') return copy.actions.create
  if (r.id === 'campaign') return copy.actions.campaign
  if (r.id === 'links_no_orders') return copy.actions.links
  return copy.actions.open
}

/**
 * Growth overview recommendations: up to three next steps worked out on the server from the
 * store's numbers, each with its reason, one action (a link, or creating the automation from
 * its template) and Dismiss, which the store remembers.
 */
export default function RecommendationsCard({ initial }: RecommendationsCardProps) {
  // Hooks
  const copy = useCopy(growthRecommendationsContent)
  const fmt = useFormat()
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  // Event handlers
  const handleDismiss = async (r: GrowthRecommendation) => {
    setBusy(r.id)
    try {
      setItems(await api.marketing.dismissRecommendation({ id: r.id }))
      toast.success(copy.dismissed)
    } finally {
      setBusy(null)
    }
  }

  const handleCreate = async (r: GrowthRecommendation) => {
    if (r.action.kind !== 'create_automation') return
    setBusy(r.id)
    try {
      const row = await api.marketing.automations.create({ template: r.action.template })
      toast.success(copy.created)
      router.push(routes.growth.automation(row.id))
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  return (
    <DataCard title={copy.title} subtitle={copy.subtitle}>
      {items.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4"
              aria-busy={busy === r.id || undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-body-strong text-foreground">{copy.cards[r.id].title}</p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.dismiss}
                  disabled={busy !== null}
                  onClick={() => void handleDismiss(r)}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <p className="flex-1 text-caption text-muted-foreground">{reasonOf(r, copy, fmt)}</p>
              {r.action.kind === 'open' ? (
                <Button
                  variant="outline"
                  className="self-end"
                  render={<Link href={r.action.href} />}
                  nativeButton={false}
                >
                  {actionLabel(r, copy)}
                </Button>
              ) : (
                <Button
                  className="self-end"
                  disabled={busy !== null}
                  onClick={() => void handleCreate(r)}
                >
                  {actionLabel(r, copy)}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
