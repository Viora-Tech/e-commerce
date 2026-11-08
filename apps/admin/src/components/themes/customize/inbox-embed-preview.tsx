'use client'

import type { InboxWidget } from '@commerce/core/inbox'
import { cn } from '@commerce/ui/lib/utils'
import type { CSSProperties } from 'react'

type InboxEmbedPreviewProps = {
  widget: InboxWidget
  greeting: string
  /** The words for an empty label and an empty greeting. */
  fallbackLabel: string
  fallbackGreeting: string
  title: string
}

/** The chat icon paths, as the storefront button draws them (`chat-icon.tsx`). */
const ICON_PATHS: Record<Exclude<InboxWidget['activatorIcon'], 'none'>, string[]> = {
  chat: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z'],
  bubble: [
    'M14 9a5 5 0 0 1-7.3 4.4L3 14.5l.9-3.4A5 5 0 1 1 14 9Z',
    'M10.5 17.8a5 5 0 0 0 6.8 1.6l3.7 1.1-.9-3.4a5 5 0 0 0-3.6-7.4',
  ],
  help: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6',
    'M12 17h.01',
  ],
}

const SIDE: Record<InboxWidget['horizontal'], string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

const LIFT: Record<InboxWidget['vertical'], string> = {
  lowest: 'pb-2',
  higher: 'pb-6',
  highest: 'pb-10',
}

/**
 * A small live picture of the storefront chat button and its greeting, redrawn on every change
 * in the Inbox embed's settings (the editor canvas does not draw app embeds). Colours left blank
 * follow the theme being edited through its CSS variables, as on the store.
 */
export default function InboxEmbedPreview({
  widget,
  greeting,
  fallbackLabel,
  fallbackGreeting,
  title,
}: InboxEmbedPreviewProps) {
  // Render logic
  const fill = widget.background || 'var(--btn-bg, var(--foreground))'
  const ink = widget.textColour || 'var(--btn-text, var(--background))'
  const button: CSSProperties = {
    background: widget.invertActivator ? ink : fill,
    color: widget.invertActivator ? fill : ink,
    fontSize: `${widget.activatorFontSize / 16}rem`,
    fontFamily: widget.inheritFont ? undefined : 'system-ui, sans-serif',
  }
  const label = widget.activatorLabel || (widget.activatorIcon === 'none' ? fallbackLabel : '')
  const paths = widget.activatorIcon === 'none' ? [] : ICON_PATHS[widget.activatorIcon]

  return (
    <div
      aria-hidden
      className={cn(
        'flex h-40 flex-col justify-end gap-2 overflow-hidden rounded-lg border border-border bg-muted px-2',
        LIFT[widget.vertical],
      )}
    >
      <div className={cn('flex', SIDE[widget.horizontal])}>
        <div
          className="max-w-[12rem] border border-border bg-card p-2.5 text-xs text-foreground shadow-sm"
          style={{ borderRadius: `${widget.borderRadius / 16}rem` }}
        >
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-muted-foreground">
            {greeting || fallbackGreeting}
          </p>
        </div>
      </div>
      <div className={cn('flex', SIDE[widget.horizontal])}>
        <span
          style={button}
          className={cn(
            'flex h-10 items-center justify-center gap-1.5 rounded-full font-medium shadow-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
            label ? 'px-4' : 'w-10',
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
              className="size-4"
            >
              {paths.map((d) => (
                <path key={d} d={d} />
              ))}
            </svg>
          ) : null}
          {label ? <span>{label}</span> : null}
        </span>
      </div>
    </div>
  )
}
