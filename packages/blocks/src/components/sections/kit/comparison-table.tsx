// Pattern after common "us vs them" comparison tables (our own implementation). See
// THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import Icon from '../../icon'
import KitHeading from './kit-heading'

/** Copy is a string in storage, a React node while edited on the canvas (ticks stay booleans). */
type ComparisonTableProps = {
  heading: ReactNode
  text: ReactNode
  ours: ReactNode
  theirs: ReactNode
  yes: string
  no: string
  rows: { feature: ReactNode; ours: boolean; theirs: boolean }[]
}

/** Features down the side, our column (highlighted) and theirs across the top. */
export default function ComparisonTable({
  heading,
  text,
  ours,
  theirs,
  yes,
  no,
  rows,
}: ComparisonTableProps) {
  // Early returns
  if (!rows?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col items-center gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <div className="w-full max-w-[48rem] overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              <th className="text-small p-[1rem] font-normal text-[var(--color-muted)]" />
              <th className="w-[7rem] bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] p-[1rem] text-center text-body font-semibold text-[var(--color-brand)]">
                {ours}
              </th>
              <th className="w-[7rem] p-[1rem] text-center text-body font-semibold text-[var(--color-muted)]">
                {theirs}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
                key={i}
                className="border-b border-[var(--color-line)] last:border-b-0"
              >
                <th scope="row" className="text-body p-[1rem] font-normal text-[var(--color-ink)]">
                  {row.feature}
                </th>
                <td className="bg-[color-mix(in_oklab,var(--color-brand)_8%,transparent)] p-[1rem] text-center">
                  <Mark on={row.ours} label={row.ours ? yes : no} strong />
                </td>
                <td className="p-[1rem] text-center">
                  <Mark on={row.theirs} label={row.theirs ? yes : no} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A tick, or a quiet dash, with its meaning for screen readers. */
function Mark({ on, label, strong }: { on: boolean; label: string; strong?: boolean }) {
  return on ? (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex size-[1.5rem] items-center justify-center rounded-full ${
        strong
          ? 'bg-[var(--color-brand)] text-[var(--color-on-brand)]'
          : 'bg-[color-mix(in_oklab,var(--color-ink)_10%,transparent)] text-[var(--color-ink)]'
      }`}
    >
      <Icon name="check" size={12} />
    </span>
  ) : (
    <span role="img" aria-label={label} className="text-[var(--color-muted)]">
      —
    </span>
  )
}
