'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import type { CampaignStatus } from '@/lib/loyalty-campaigns'
import { routes } from '@/lib/routes'

type Campaign = Awaited<ReturnType<typeof api.loyalty.campaigns.list>>[number]

type CampaignRowActionsProps = {
  campaign: Campaign
  status: CampaignStatus
  onChanged: () => void
}

/** A campaign row's menu: edit, end a running one now, delete (each end or delete asks first). */
export default function CampaignRowActions({
  campaign,
  status,
  onChanged,
}: CampaignRowActionsProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const [asking, setAsking] = useState<'end' | 'remove' | null>(null)

  // Event handlers
  const handleEnd = async () => {
    const now = new Date()
    // A running campaign ends now; one not started yet is switched off.
    const endsAt = status === 'running' ? now : new Date(campaign.endsAt)
    try {
      await api.loyalty.campaigns.save({
        id: campaign.id,
        campaign: {
          name: campaign.name,
          startsAt: new Date(campaign.startsAt),
          endsAt,
          tierIds: campaign.tierIds,
          bonusType: campaign.bonusType,
          multiplierBp: campaign.multiplierBp,
          bonusPoints: campaign.bonusPoints,
          active: status === 'running',
        },
      })
      toast.success(copy.campaigns.ended)
      onChanged()
    } catch (err) {
      toast.error(errorText(err, copy.campaigns.failed))
      throw err
    }
  }

  const handleRemove = async () => {
    try {
      await api.loyalty.campaigns.remove({ id: campaign.id })
      toast.success(copy.campaigns.removed)
      onChanged()
    } catch (err) {
      toast.error(errorText(err, copy.campaigns.failed))
      throw err
    }
  }

  // Render logic
  const c = copy.campaigns

  return (
    <>
      <ActionMenu
        label={c.actions}
        items={[
          { label: c.edit, href: routes.apps.page('loyalty', 'campaigns', campaign.id) },
          { label: c.end, onSelect: () => setAsking('end'), hidden: status === 'ended' },
          { label: c.remove, destructive: true, onSelect: () => setAsking('remove') },
        ]}
      />
      <ConfirmDialog
        open={asking === 'end'}
        onOpenChange={(open) => setAsking(open ? 'end' : null)}
        title={c.endTitle}
        body={c.endBody}
        confirmLabel={c.end}
        cancelLabel={c.cancel}
        tone="destructive"
        onConfirm={handleEnd}
        stopPropagation
      />
      <ConfirmDialog
        open={asking === 'remove'}
        onOpenChange={(open) => setAsking(open ? 'remove' : null)}
        title={c.removeTitle}
        body={c.removeBody}
        confirmLabel={c.remove}
        cancelLabel={c.cancel}
        tone="destructive"
        onConfirm={handleRemove}
        stopPropagation
      />
    </>
  )
}
