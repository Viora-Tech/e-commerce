'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import PlacementArt from '@/components/apps/loyalty/placement-art'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyPlacementsContent } from '@/data/loyalty-placements'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import type { LoyaltyPage } from '@/lib/loyalty-placements'

type LoyaltyPageCardProps = {
  page: LoyaltyPage
  /** The saved settings; the switch saves them with only `pages` changed. */
  settings: LoyaltySettings
  /** The store's public origin, for View page; null hides the link. */
  origin: string | null
  onSaved: (next: LoyaltySettings) => void
}

/**
 * One of the pages the program adds to the store (Essential Loyalty's "Embedded content" and
 * "Customer accounts" cards): its title with an On or Off chip, what it shows, a switch that saves
 * at once, View page on the store, and a small sketch.
 */
export default function LoyaltyPageCard({ page, settings, origin, onSaved }: LoyaltyPageCardProps) {
  // Hooks
  const copy = useCopy(loyaltyPlacementsContent)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSwitch = async (on: boolean) => {
    setSaving(true)
    try {
      const next = await api.loyalty.settings.save({
        ...settings,
        pages: { ...settings.pages, [page.id]: on },
      })
      onSaved(next)
      toast.success(copy.pages.saved)
    } catch (err) {
      toast.error(errorText(err, copy.pages.failed))
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const item = copy.pages.items[page.id]
  const on = settings.pages[page.id]
  return (
    <DataCard
      title={item.title}
      action={
        <StatusChip tone={on ? 'success' : 'neutral'}>
          {on ? copy.pages.on : copy.pages.off}
        </StatusChip>
      }
    >
      <div className="flex items-end gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-body text-foreground">{item.body}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id={`loyalty-page-${page.id}`}
              checked={on}
              disabled={saving}
              aria-label={copy.pages.switchOn(item.title)}
              onCheckedChange={(next) => void handleSwitch(next)}
            />
            {origin && on ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={`${origin}${page.path}`} target="_blank" rel="noreferrer" />}
              >
                {copy.pages.view}
                <ExternalLink />
              </Button>
            ) : null}
          </div>
        </div>
        <PlacementArt id={page.id} />
      </div>
    </DataCard>
  )
}
