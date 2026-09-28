import type { CSSProperties } from 'react'
import { rem } from '../../element-style'
import ElementBox from './element-box'

export type SpacerProps = {
  height: { mobile: number; tablet: number; desktop: number }
  style: unknown
}

/** Empty space, its height set per breakpoint. */
export default function SpacerElement({ height, style }: SpacerProps) {
  // Render logic
  const vars = {
    '--sp-m': rem(height?.mobile, 400) ?? '0rem',
    '--sp-t': rem(height?.tablet, 400) ?? '0rem',
    '--sp-d': rem(height?.desktop, 400) ?? '0rem',
  } as CSSProperties
  return (
    <ElementBox look={style} className="custom-spacer w-full">
      <div
        aria-hidden
        className="h-[var(--sp-m)] md:h-[var(--sp-t)] lg:h-[var(--sp-d)]"
        style={vars}
      />
    </ElementBox>
  )
}
