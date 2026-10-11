import type { ReactNode } from 'react'
import BlockToolbarBar from './block-toolbar-bar'

type BlockToolbarProps = {
  children: ReactNode
  hover: boolean
  isSelected: boolean
  componentId: string
  componentType: string
}

/**
 * Puck's `componentOverlay` override: Puck's own outline (`children`; solid when selected,
 * dashed on hover, vendor-puck.css) plus, for the hovered or selected block only, the floating
 * toolbar (`BlockToolbarBar`). Every block on the canvas mounts one of these, so it reads
 * nothing from the store itself: typing used to re-render one subscribed toolbar per block.
 */
export default function BlockToolbar({
  children,
  hover,
  isSelected,
  componentId,
  componentType,
}: BlockToolbarProps) {
  // Early returns
  if (!(isSelected || hover)) return <>{children}</>

  return (
    <>
      {children}
      <BlockToolbarBar
        isSelected={isSelected}
        componentId={componentId}
        componentType={componentType}
      />
    </>
  )
}
