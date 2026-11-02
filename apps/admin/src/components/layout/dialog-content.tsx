'use client'

import { cn } from '@commerce/ui/lib/utils'
import { DialogContent as BaseDialogContent } from '@commerce/ui/shadcn/dialog'
import type { ComponentProps } from 'react'

type DialogContentProps = ComponentProps<typeof BaseDialogContent> & {
  /**
   * `standard` for every form and confirm popup (one width across the admin); `wide` only for
   * tools that need room, like the image editor or a picker grid.
   */
  size?: 'standard' | 'wide'
}

/** Spacing a dialog sets for its own content (`gap-5`, `p-6`): it belongs on the scroller. */
const INNER = /^(gap|gap-[xy]|p|px|py|pt|pb|pl|pr|space-y)-/

const WIDTH = {
  standard: 'sm:max-w-[38rem]',
  wide: 'sm:max-w-[56rem]',
} as const

/**
 * The one admin popup shell (owner, 31 Oct and 2 Nov 2026: every dialog the same width and
 * height). One width per size, one maximum height for all; a long dialog scrolls between its
 * title, which stays at the top (`dialog-header.tsx`), and its buttons, which stay at the bottom
 * (`dialog-footer.tsx`). The close button sits outside the scroller, so it never scrolls away.
 */
export default function DialogContent({
  size = 'standard',
  className,
  children,
  ...props
}: DialogContentProps) {
  // Render logic
  const tokens = (typeof className === 'string' ? className : '').split(/\s+/).filter(Boolean)
  const inner = tokens.filter((t) => INNER.test(t)).join(' ')
  const outer = tokens.filter((t) => !INNER.test(t)).join(' ')

  return (
    <BaseDialogContent
      {...props}
      className={cn(
        // The close button sits above the sticky title bar.
        'flex max-h-[min(85svh,48rem)] flex-col gap-0 overflow-hidden p-0 [&>[data-slot=dialog-close]]:z-20',
        WIDTH[size],
        outer,
      )}
    >
      <div
        className={cn('grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-4', inner)}
      >
        {children}
      </div>
    </BaseDialogContent>
  )
}
