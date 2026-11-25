'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { type ReactNode, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'

type SetupCardProps = {
  title: string
  description: string
  /** Something is set up: the chip reads Active, else Inactive. */
  active: boolean
  /** The editor, shown after Set up. */
  children: ReactNode
}

/**
 * UpPromote's "card + Active/Inactive chip + Set up" row (Special product commission,
 * Auto-discount, Excluded products): the editor opens in place under the line.
 */
export default function SetupCard({ title, description, active, children }: SetupCardProps) {
  // Hooks
  const { editor: copy } = useCopy(affiliatesLayoutContent)
  const [open, setOpen] = useState(false)

  // Render logic
  return (
    <DataCard
      title={
        <span className="flex flex-wrap items-center gap-2">
          {title}
          <StatusChip tone={active ? 'success' : 'neutral'}>
            {active ? copy.active : copy.inactive}
          </StatusChip>
        </span>
      }
      subtitle={description}
      action={
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? copy.done : copy.setUp}
        </Button>
      }
      bodyClassName={open ? 'flex flex-col gap-3' : 'hidden'}
    >
      {open ? children : null}
    </DataCard>
  )
}
