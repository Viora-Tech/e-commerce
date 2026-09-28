import type { CSSProperties } from 'react'
import { rem } from '../../element-style'
import { asSlot } from '../../slot-types'
import ElementBox from './element-box'

export type GridProps = {
  columns: { mobile: number; tablet: number; desktop: number }
  rows: number
  gap: number
  items: unknown
  style: unknown
}

const clampCount = (n: unknown, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), 8) : fallback

/** A responsive grid: one slot, its items flowing into N columns per breakpoint. */
export default function GridBlock({ columns, rows, gap, items, style }: GridProps) {
  // Render logic
  const Items = asSlot(items)
  const layout = {
    '--grid-m': `repeat(${clampCount(columns?.mobile, 1)},minmax(0,1fr))`,
    '--grid-t': `repeat(${clampCount(columns?.tablet, 2)},minmax(0,1fr))`,
    '--grid-d': `repeat(${clampCount(columns?.desktop, 3)},minmax(0,1fr))`,
    gap: rem(gap, 200) ?? undefined,
    gridTemplateRows: rows > 0 ? `repeat(${clampCount(rows, 1)},auto)` : undefined,
  } as CSSProperties

  return (
    <ElementBox look={style} className="custom-grid w-full">
      <Items
        className="grid grid-cols-[var(--grid-m)] md:grid-cols-[var(--grid-t)] lg:grid-cols-[var(--grid-d)]"
        style={layout}
        minEmptyHeight={96}
      />
    </ElementBox>
  )
}
