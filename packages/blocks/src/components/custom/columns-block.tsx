import type { CSSProperties } from 'react'
import { rem } from '../../element-style'
import { asSlot, cx } from '../../slot-types'
import ElementBox from './element-box'

export type ColumnsLayout = {
  desktop: string
  tablet: 'same' | 'stack' | 'two'
  mobile: 'stack' | 'same'
}

export type ColumnsProps = {
  columns: { content: unknown }[]
  layout: ColumnsLayout
  gap: number
  align: 'start' | 'center' | 'end' | 'stretch'
  style: unknown
}

/** Column width presets on computers, as `fr` ratios (`1:2` = a third and two thirds). */
export const COLUMN_PRESETS: Record<number, string[]> = {
  2: ['1:1', '1:2', '2:1', '1:3', '3:1'],
  3: ['1:1:1', '1:2:1', '2:1:1', '1:1:2'],
  4: ['1:1:1:1'],
}

/** A `grid-template-columns` value for a preset, falling back to equal widths. */
function columnTemplate(preset: string, count: number): string {
  const parts = preset.split(':').map(Number)
  const valid = parts.length === count && parts.every((n) => Number.isInteger(n) && n > 0 && n < 10)
  return (valid ? parts : Array.from({ length: count }, () => 1))
    .map((n) => `minmax(0,${n}fr)`)
    .join(' ')
}

/**
 * Two to four columns, each a slot. Widths come from a preset on computers;
 * tablets keep them, stack or go two across; phones stack or keep them. The
 * three templates are CSS variables switched by breakpoint classes, so the
 * server markup is final.
 */
export default function ColumnsBlock({ columns, layout, gap, align, style }: ColumnsProps) {
  // Render logic
  const items = (columns ?? []).slice(0, 4)
  const count = Math.max(1, items.length)
  const desktop = columnTemplate(layout?.desktop ?? '', count)
  const tablet =
    layout?.tablet === 'stack'
      ? 'minmax(0,1fr)'
      : layout?.tablet === 'two'
        ? 'repeat(2,minmax(0,1fr))'
        : desktop
  const mobile = layout?.mobile === 'same' ? desktop : 'minmax(0,1fr)'
  const vars = {
    '--cols-d': desktop,
    '--cols-t': tablet,
    '--cols-m': mobile,
    gap: rem(gap, 200) ?? undefined,
    alignItems: align === 'stretch' ? 'stretch' : align,
  } as CSSProperties

  return (
    <ElementBox look={style} className="custom-columns w-full">
      <div
        className="grid grid-cols-[var(--cols-m)] md:grid-cols-[var(--cols-t)] lg:grid-cols-[var(--cols-d)]"
        style={vars}
      >
        {items.map((column, i) => {
          const Column = asSlot(column?.content)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: columns have no id of their own; their order is their identity.
            <div key={i} className={cx('custom-columns__column min-w-0')}>
              <Column
                className="flex h-full flex-col"
                style={{ gap: rem(gap, 200) ?? undefined }}
                minEmptyHeight={96}
              />
            </div>
          )
        })}
      </div>
    </ElementBox>
  )
}
