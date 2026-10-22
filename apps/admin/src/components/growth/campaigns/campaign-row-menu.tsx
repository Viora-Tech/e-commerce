'use client'

import type { MarketingCampaignStatus } from '@commerce/core/marketing'
import { AppWindow, CancelCircle, Copy, Trash2 } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { campaignsContent } from '@/data/marketing-campaigns'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type CampaignRowMenuProps = {
  campaign: { id: string; name: string; status: MarketingCampaignStatus }
}

/**
 * The ⋯ menu on a campaign row: open, duplicate, cancel a scheduled send and delete. A campaign
 * that is sending or sent cannot be deleted, so the menu only offers that before it goes out.
 */
export default function CampaignRowMenu({ campaign }: CampaignRowMenuProps) {
  // Hooks
  const { row: copy } = useCopy(campaignsContent)
  const router = useRouter()
  const [confirm, setConfirm] = useState<'unschedule' | 'delete' | null>(null)

  // Event handlers
  const handleDuplicate = async () => {
    try {
      const row = await api.marketing.campaigns.duplicate({
        id: campaign.id,
        prefix: copy.copyPrefix,
      })
      if (!row) throw new Error(copy.failed)
      toast.success(copy.duplicated)
      router.push(routes.growth.campaign(row.id))
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    }
  }

  const handleUnschedule = async () => {
    try {
      await api.marketing.campaigns.cancel({ id: campaign.id })
      toast.success(copy.unscheduled)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      throw err
    }
  }

  const handleDelete = async () => {
    try {
      await api.marketing.campaigns.delete({ id: campaign.id })
      toast.success(copy.deleted)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  const locked = campaign.status === 'sending' || campaign.status === 'sent'

  return (
    <>
      <RowMenu
        items={[
          { label: copy.open, icon: AppWindow, href: routes.growth.campaign(campaign.id) },
          { label: copy.duplicate, icon: Copy, onSelect: handleDuplicate },
          {
            label: copy.unschedule,
            icon: CancelCircle,
            hidden: campaign.status !== 'scheduled',
            onSelect: () => setConfirm('unschedule'),
          },
          {
            label: copy.delete,
            icon: Trash2,
            destructive: true,
            hidden: locked,
            onSelect: () => setConfirm('delete'),
          },
        ]}
      />
      <ConfirmDialog
        open={confirm === 'unschedule'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={copy.unscheduleTitle(campaign.name)}
        body={copy.unscheduleBody}
        confirmLabel={copy.unscheduleConfirm}
        cancelLabel={copy.keep}
        tone="default"
        stopPropagation
        onConfirm={handleUnschedule}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={copy.deleteTitle(campaign.name)}
        body={copy.deleteBody}
        confirmLabel={copy.deleteConfirm}
        cancelLabel={copy.keep}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
