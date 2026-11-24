'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyPlacementsContent } from '@/data/loyalty-placements'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { customizeHref, LOYALTY_PLACEMENTS, placementStatus } from '@/lib/loyalty-placements'
import { routes } from '@/lib/routes'

/** The chip tone for each status. */
const TONE = { ready: 'success', off: 'neutral', unknown: 'info' } as const

/**
 * Where the Loyalty app shows on the storefront: the floating widget and the referral pop-up
 * (app embeds, Ready or Off from the live theme) and the product, card and cart points (app
 * blocks). Each card says where to switch it on and opens Customize there.
 */
export default function LoyaltyPlacementsPage() {
  // Hooks
  const copy = useCopy(loyaltyPlacementsContent)
  const { data, failed, retry } = useLoad(async () => {
    const themes = await api.themes.list()
    const live = themes.find((t) => t.role === 'main') ?? null
    return { live: live ? { id: live.id, appEmbeds: live.settings.appEmbeds } : null }
  })

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} summary={copy.subtitle} />
        <LoadFailedState size="page" heading={copy.loadFailed} failed={failed} onRetry={retry} />
      </div>
    )
  }
  if (!data) {
    return <SectionPageSkeleton cards={5} title={copy.title} subtitle={copy.subtitle} />
  }

  // Render logic
  const editor = data.live ? routes.onlineStore.themeEditor(data.live.id) : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      {editor ? null : (
        <p className="rounded-lg border border-line bg-muted px-4 py-3 text-body text-muted-foreground">
          {copy.noTheme}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {LOYALTY_PLACEMENTS.map((p) => {
          const status = placementStatus(p, data.live?.appEmbeds ?? null)
          const item = copy.items[p.id]
          return (
            <DataCard
              key={p.id}
              title={item.title}
              action={<StatusChip tone={TONE[status]}>{copy.status[status]}</StatusChip>}
            >
              <div className="flex flex-col gap-3">
                <p className="text-body text-foreground">{item.body}</p>
                <p className="text-caption text-muted-foreground">{copy.where[p.kind]}</p>
                {editor ? (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={customizeHref(editor, p.kind)} />}
                    >
                      {copy.open}
                      <ExternalLink />
                    </Button>
                  </div>
                ) : null}
              </div>
            </DataCard>
          )
        })}
      </div>
    </div>
  )
}
