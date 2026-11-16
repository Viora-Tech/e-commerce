'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { CSSProperties } from 'react'
import { customizeInboxEmbedContent } from '@/data/customize-inbox-embed'
import { useCopy } from '@/hooks/use-copy'
import { INBOX_ICON_PATHS, INBOX_LAUNCHER_BOTTOM } from '@/lib/inbox-chat-icons'
import { useInboxEmbed } from '@/lib/inbox-embed-store'

const SIDE = {
  left: 'left-4',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-4',
} as const

/**
 * The Inbox chat button on the editor canvas, where the store shows it: the corner, height,
 * colours, label and icon from App embeds → Online store chat, moving as those settings change
 * (`inbox-embed-store`). The storefront leaves it out of theme previews, so without this the
 * canvas never showed the chat at all. A picture only: it does not open a chat.
 */
export default function CanvasInboxLauncher() {
  // Hooks
  const copy = useCopy(customizeInboxEmbedContent)
  const { settings } = useInboxEmbed()

  // Early returns
  const widget = settings?.widget
  if (!widget?.enabled) return null

  // Render logic
  const fill = widget.background || 'var(--btn-bg, var(--color-ink, CanvasText))'
  const ink = widget.textColour || 'var(--btn-text, var(--color-bg, Canvas))'
  const style: CSSProperties = {
    bottom: `calc(${INBOX_LAUNCHER_BOTTOM[widget.vertical]} + env(safe-area-inset-bottom))`,
    background: widget.invertActivator ? ink : fill,
    color: widget.invertActivator ? fill : ink,
    fontSize: `${widget.activatorFontSize / 16}rem`,
    fontFamily: widget.inheritFont ? undefined : 'system-ui, sans-serif',
  }
  const label = widget.activatorLabel || (widget.activatorIcon === 'none' ? copy.previewChat : '')
  const paths = widget.activatorIcon === 'none' ? [] : INBOX_ICON_PATHS[widget.activatorIcon]

  return (
    <div
      aria-hidden
      title={copy.label}
      style={style}
      className={cn(
        'pointer-events-none fixed z-[999] flex h-14 items-center justify-center gap-2 rounded-full font-medium shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.16)] transition-[left,right,bottom] duration-200 ease-out motion-reduce:transition-none',
        label ? 'px-5' : 'w-14',
        SIDE[widget.horizontal],
      )}
    >
      {paths.length > 0 ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={label ? 'size-5' : 'size-6'}
        >
          {paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      ) : null}
      {label ? <span>{label}</span> : null}
    </div>
  )
}
