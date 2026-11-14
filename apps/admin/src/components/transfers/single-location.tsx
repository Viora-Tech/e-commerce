'use client'

import { ArrowLeftRight, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import EmptyState from '@/components/layout/empty-state'
import { locationsContent, transfersContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'

type SingleLocationProps = { canAdd: boolean; onAdd: () => void }

/** Shown instead of an empty table while the store has only one location. */
export default function SingleLocation({ canAdd, onAdd }: SingleLocationProps) {
  // Hooks
  const copy = useCopy(transfersContent)
  const locationCopy = useCopy(locationsContent)

  // Render logic
  return (
    <EmptyState
      variant="page"
      heading={copy.single.heading}
      body={copy.single.body}
      icon={ArrowLeftRight}
      action={
        canAdd ? (
          <Button onClick={onAdd}>
            <Plus />
            {locationCopy.add}
          </Button>
        ) : undefined
      }
    />
  )
}
