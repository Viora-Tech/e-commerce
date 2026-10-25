// Pattern after common company-story timelines (our own implementation). See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import { cx } from '../../../slot-types'
import KitHeading from './kit-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type TimelineProps = {
  heading: ReactNode
  text: ReactNode
  milestones: { date: ReactNode; title: ReactNode; text: ReactNode }[]
}

/**
 * Milestones down a line: one column on phones, alternating sides on desktop. The newest
 * (last) milestone's dot is filled in the brand colour.
 */
export default function Timeline({ heading, text, milestones }: TimelineProps) {
  // Early returns
  if (!milestones?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <ol className="relative flex flex-col gap-[2rem] text-left before:absolute before:top-[0.5rem] before:bottom-[0.5rem] before:left-[0.4375rem] before:w-[0.125rem] before:bg-[color-mix(in_oklab,var(--color-ink)_14%,transparent)] md:before:left-1/2">
        {milestones.map((m, i) => {
          const last = i === milestones.length - 1
          const right = i % 2 === 1
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
              key={i}
              className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-[1.25rem] md:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] md:gap-x-[2rem]"
            >
              <span
                aria-hidden
                className={cx(
                  'relative z-10 mt-[0.375rem] size-[0.9375rem] rounded-full border-2 border-[var(--color-brand)] md:col-start-2 md:row-start-1',
                  last ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-bg)]',
                )}
              />
              <div
                className={cx(
                  'flex flex-col gap-[0.375rem] md:row-start-1',
                  right ? 'md:col-start-3' : 'md:col-start-1 md:items-end md:text-right',
                )}
              >
                {m.date ? (
                  <p className="text-caption uppercase tracking-[0.08em] text-[var(--color-brand)]">
                    {m.date}
                  </p>
                ) : null}
                {m.title ? <h3 className="h5 text-[var(--color-ink)]">{m.title}</h3> : null}
                {m.text ? <p className="text-small text-[var(--color-muted)]">{m.text}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
