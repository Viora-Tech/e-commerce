'use client'

import type { CollectionStatus } from '@commerce/core/collections'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useId } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { collectionDetailContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'

type CollectionVisibilityCardProps = {
  status: CollectionStatus
  onChange: (status: CollectionStatus) => void
}

/** "Visibility" card: the online store switch (active or draft). */
export default function CollectionVisibilityCard({
  status,
  onChange,
}: CollectionVisibilityCardProps) {
  // Hooks
  const { visibility: copy } = useCopy(collectionDetailContent)
  const id = useId()

  // Render logic
  const on = status === 'active'

  return (
    <Card size="form">
      <CardHeader className="grid-cols-[1fr_auto] items-center">
        <CardTitle>{copy.heading}</CardTitle>
        <StatusChip tone={on ? 'neutral' : 'attention'}>
          {on ? copy.chipOn : copy.chipOff}
        </StatusChip>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <label htmlFor={id} className="text-body font-medium text-foreground">
              {copy.label}
            </label>
            <span className="text-caption text-muted-foreground">
              {on ? copy.help : copy.helpOff}
            </span>
          </div>
          <Switch
            id={id}
            checked={on}
            onCheckedChange={(next) => onChange(next ? 'active' : 'draft')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
