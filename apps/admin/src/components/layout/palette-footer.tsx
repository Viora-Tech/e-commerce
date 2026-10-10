'use client'

import { Kbd } from '@commerce/ui/shadcn/kbd'
import { paletteContent } from '@/data/command-palette'
import { useCopy } from '@/hooks/use-copy'
import { modKey } from '@/lib/assistant-events'

/** The keys that work inside the palette, along the bottom. Hidden on phones (no keyboard). */
export default function PaletteFooter() {
  // Hooks
  const copy = useCopy(paletteContent)

  // Render logic
  const hints = [
    { keys: [copy.footer.keys.move], label: copy.footer.move },
    { keys: [copy.footer.keys.open], label: copy.footer.open },
    { keys: [modKey(), copy.footer.keys.open], label: copy.footer.newTab },
    { keys: [copy.footer.keys.scope], label: copy.footer.scope },
    { keys: [copy.footer.keys.close], label: copy.footer.close },
  ]

  return (
    <div className="hidden items-center gap-4 border-t border-hairline px-4 py-2.5 sm:flex">
      {hints.map((hint) => (
        <span
          key={hint.label}
          className="flex items-center gap-1.5 text-caption text-muted-foreground"
        >
          <span className="flex items-center gap-1">
            {hint.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </span>
          {hint.label}
        </span>
      ))}
    </div>
  )
}
