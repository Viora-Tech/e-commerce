import type { ElementType, ReactNode } from 'react'
import { elementStyle } from '../../element-style'
import { cx } from '../../slot-types'

type ElementBoxProps = {
  /** The element's stored `style` (spacing, size, text, colour, corners, visibility). */
  look: unknown
  as?: ElementType
  className?: string
  children: ReactNode
}

/** The outer element every custom-section block draws: its style panel as inline CSS. */
export default function ElementBox({
  look,
  as: Tag = 'div',
  className,
  children,
}: ElementBoxProps) {
  // Render logic
  const { className: visibility, style } = elementStyle(look as Parameters<typeof elementStyle>[0])
  return (
    <Tag className={cx('custom-element', className, visibility)} style={style}>
      {children}
    </Tag>
  )
}
