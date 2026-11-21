'use client'

import { FREE_BLOCK_TYPES, type FreeBlockType } from '@commerce/notifications/design'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'

type DesignPaletteProps = {
  onAdd: (type: FreeBlockType) => void
}

/** The blocks a merchant can add to an email, one button each (added under the selected block). */
export default function DesignPalette({ onAdd }: DesignPaletteProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  return (
    <section aria-label={copy.editor.add} className="flex flex-col gap-2">
      <h3 className="text-caption font-semibold text-muted-foreground">{copy.editor.add}</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {FREE_BLOCK_TYPES.map((type) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => onAdd(type)}
          >
            <Plus aria-hidden="true" />
            {copy.blocks[type]}
          </Button>
        ))}
      </div>
    </section>
  )
}
