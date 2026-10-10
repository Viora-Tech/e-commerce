'use client'

import { ExitFullViewIcon, FullViewIcon } from '@commerce/ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { modKey } from '@/lib/assistant-events'
import { useEditorView } from '@/lib/customize-view'

type FullViewButtonProps = {
  /** The top bar's square icon-button look. */
  className: string
}

/** The top bar's full-view switch: the page alone, rail and both panels hidden, and back. */
export default function FullViewButton({ className }: FullViewButtonProps) {
  // Hooks
  const copy = useCopy(customizeContent.view)
  const view = useEditorView()

  // Render logic
  const label = view.full ? copy.exitFullView : copy.fullView
  const Icon = view.full ? ExitFullViewIcon : FullViewIcon

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => view.setFull(!view.full)}
            aria-label={label}
            aria-pressed={view.full}
            className={className}
          />
        }
      >
        <Icon aria-hidden weight="regular" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {view.full ? `${label} (Esc)` : copy.fullViewHint(`\\ · ${modKey()} .`)}
      </TooltipContent>
    </Tooltip>
  )
}
