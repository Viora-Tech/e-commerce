import { ActionBar } from '@puckeditor/core'
import { Children, isValidElement, type ReactNode } from 'react'

type CanvasActionBarProps = {
  /**
   * What Puck 0.23 puts in its action bar, in order: the inline rich-text menu (a fragment
   * of menu + separator, only while text in this block is being edited), then duplicate and
   * delete. `SectionOverlay` already draws the label, move, duplicate and delete.
   */
  children?: ReactNode
}

/** First child of the rich-text fragment: the B/I/U menu without its trailing separator. */
function richTextMenu(children: ReactNode): ReactNode {
  const first = Array.isArray(children) ? children[0] : null
  if (!isValidElement<{ children?: ReactNode }>(first)) return null
  return Children.toArray(first.props.children)[0] ?? null
}

/**
 * Puck's `actionBar` override for the Customize canvas. It keeps only Puck's inline
 * rich-text menu (bold, italic, underline, lists, link) so clicking body copy on the canvas
 * shows the formatting bar, and draws nothing otherwise: block actions live in
 * `SectionOverlay`, so they are not shown twice.
 */
export default function CanvasActionBar({ children }: CanvasActionBarProps) {
  // Early returns
  const menu = richTextMenu(children)
  if (!menu) return null

  return (
    <ActionBar>
      <ActionBar.Group>{menu}</ActionBar.Group>
    </ActionBar>
  )
}
