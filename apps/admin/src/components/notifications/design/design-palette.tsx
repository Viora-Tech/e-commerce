'use client'

import { FREE_BLOCK_TYPES, type FreeBlockType } from '@commerce/notifications/design'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignPaletteTile from './design-palette-tile'

type DesignPaletteProps = {
  /** The email holds the most blocks it can: tiles neither drag nor add. */
  full: boolean
  onAdd: (type: FreeBlockType) => void
}

/** The blocks a merchant can add to an email: drag one into the list or click it. */
export default function DesignPalette({ full, onAdd }: DesignPaletteProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  return (
    <section aria-label={copy.editor.add} className="flex flex-col gap-2">
      <h3 className="text-caption font-semibold text-muted-foreground">{copy.editor.add}</h3>
      <p className="text-caption text-muted-foreground">
        {full ? copy.editor.full : copy.editor.addHint}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {FREE_BLOCK_TYPES.map((type) => (
          <DesignPaletteTile
            key={type}
            type={type}
            label={copy.blocks[type]}
            disabled={full}
            onAdd={onAdd}
          />
        ))}
      </div>
    </section>
  )
}
