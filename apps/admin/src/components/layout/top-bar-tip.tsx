'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import type { ReactElement } from 'react'

type TopBarTipProps = {
  label: string
  /** The control the tip names; it becomes the tooltip's trigger (menus and popovers too). */
  children: ReactElement
}

/**
 * A top-bar tooltip (Figma "TB · Hover states"): below the control, 12px on the inverse
 * surface, radius 6, no arrow. The provider's delay applies to the first one, then they are
 * instant while the pointer moves along the bar.
 */
export default function TopBarTip({ label, children }: TopBarTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side="bottom"
        sideOffset={8}
        className="rounded-[0.375rem] px-3 py-1.5 text-xs leading-4 *:hidden"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
