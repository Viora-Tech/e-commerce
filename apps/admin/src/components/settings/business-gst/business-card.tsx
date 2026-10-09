'use client'

import type { Business } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import SettingsCard from '@/components/settings/settings-card'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'

type BusinessCardProps = {
  business: Business | null
  canManage: boolean
  onEdit: (business: Business) => void
}

/** "Your business": the main business's legal name, shop name and PAN. */
export default function BusinessCard({ business, canManage, onEdit }: BusinessCardProps) {
  // Hooks
  const { business: copy } = useCopy(businessGstContent)

  return (
    <SettingsCard title={copy.heading} description={copy.help}>
      {business ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <dl className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-caption text-muted-foreground">{copy.legalName}</dt>
              <dd className="truncate text-body-strong text-ink-strong">{business.legalName}</dd>
              {business.tradeName ? (
                <dd className="truncate text-body text-muted-foreground">{business.tradeName}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">{copy.pan}</dt>
              <dd className="font-mono text-body text-ink-strong">{business.pan}</dd>
            </div>
          </dl>
          {canManage ? (
            <Button variant="outline" size="sm" onClick={() => onEdit(business)}>
              {copy.edit}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      )}
    </SettingsCard>
  )
}
