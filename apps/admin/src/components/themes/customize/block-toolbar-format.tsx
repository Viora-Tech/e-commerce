'use client'

import { Children, isValidElement, type ReactNode, useState } from 'react'
import { createPortal } from 'react-dom'

type BlockToolbarFormatProps = {
  /**
   * What Puck 0.23 puts in its action bar, in order: the inline rich-text menu (a fragment
   * of menu + separator, only while text in this block is being edited), then duplicate and
   * delete. `BlockToolbar` already draws the block's actions.
   */
  children?: ReactNode
}

/** Attribute on the empty span at the end of `BlockToolbar` that receives the menu. */
export const BLOCK_TOOLBAR_FORMAT_SLOT = 'data-block-toolbar-format'

/** First child of the rich-text fragment: the B/I/U menu without its trailing separator. */
function richTextMenu(children: ReactNode): ReactNode {
  const first = Array.isArray(children) ? children[0] : null
  if (!isValidElement<{ children?: ReactNode }>(first)) return null
  return Children.toArray(first.props.children)[0] ?? null
}

/**
 * Puck's `actionBar` override. Puck only hands the inline rich-text menu (bold, italic,
 * underline, plus our link control, `inline-format-menu.tsx`) to its action bar, so this
 * moves that menu into the selected block's single toolbar (`BlockToolbar`, drawn in the
 * same Puck overlay) instead of drawing a second bar. Puck's own action bar stays empty.
 */
export default function BlockToolbarFormat({ children }: BlockToolbarFormatProps) {
  // Hooks
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)

  // Render logic
  const menu = richTextMenu(children)
  const slot =
    anchor
      ?.closest('[data-puck-overlay]')
      ?.querySelector<HTMLElement>(`[${BLOCK_TOOLBAR_FORMAT_SLOT}]`) ?? null

  return (
    <>
      <span ref={setAnchor} hidden />
      {menu && slot
        ? // Puck's own action-button colours load after ours in the canvas, hence the `!`s.
          createPortal(
            <>
              <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border" />
              {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: only keeps the menu's clicks from reaching Puck's canvas (which would clear the selection); the buttons inside handle their own keys. */}
              <span
                onClick={(e) => e.stopPropagation()}
                className="flex items-center [&_[data-puck-rte-menu]]:flex [&_[data-puck-rte-menu]]:items-center [&_[data-puck-rte-menu]]:gap-0.5 [&_[data-puck-rte-menu]>div]:flex [&_[data-puck-rte-menu]>div]:gap-0.5 [&_[data-puck-rte-menu]>div]:p-0! [&_button]:flex [&_button]:size-6 [&_button]:items-center [&_button]:justify-center [&_button]:rounded-md [&_button]:bg-transparent! [&_button]:text-muted-foreground! [&_button]:opacity-100! [&_button]:transition-colors [&_button]:duration-150 motion-reduce:[&_button]:transition-none [&_button:hover]:bg-accent! [&_button:hover]:text-foreground! [&_button[class*='--active']]:bg-primary-soft! [&_button[class*='--active']]:text-primary! [&_button[aria-pressed=true]]:bg-primary-soft! [&_button[aria-pressed=true]]:text-primary! [&_svg]:size-3.5!"
              >
                {menu}
              </span>
            </>,
            slot,
          )
        : null}
    </>
  )
}
