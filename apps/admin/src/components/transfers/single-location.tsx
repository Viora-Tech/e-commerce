'use client'

import { ArrowLeftRight, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import EmptyState from '@/components/layout/empty-state'
import { locationsContent, transfersContent } from '@/data/inventory'

type SingleLocationProps = { canAdd: boolean; onAdd: () => void }

/** Shown instead of an empty table while the store has only one location. */
export default function SingleLocation({ canAdd, onAdd }: SingleLocationProps) {
  return (
    <Card inset="y-10">
      <EmptyState
        heading={transfersContent.single.heading}
        body={transfersContent.single.body}
        icon={ArrowLeftRight}
        action={
          canAdd ? (
            <Button onClick={onAdd}>
              <Plus />
              {locationsContent.add}
            </Button>
          ) : undefined
        }
      />
    </Card>
  )
}
