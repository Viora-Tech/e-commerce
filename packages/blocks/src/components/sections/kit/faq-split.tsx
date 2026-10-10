// Pattern after common two-column FAQ layouts (our own implementation). See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import type { Link } from '../../../sections/framed'
import Icon from '../../icon'
import RichCopy from '../../rich-copy'
import KitButtons from './kit-buttons'

/** Copy is a string in storage, a React node while edited on the canvas. */
type FaqSplitProps = {
  heading: ReactNode
  text: ReactNode
  contactHeading: ReactNode
  contact: Link
  items: { question: ReactNode; answer: ReactNode }[]
  /** On the Customize canvas every answer is open, so it can be clicked and edited. */
  editing: boolean
}

/**
 * The heading, a short intro and a "still have a question?" card on one side, the questions on
 * the other. Native `<details>`: keyboard and screen readers work with no script at all.
 */
export default function FaqSplit({
  heading,
  text,
  contactHeading,
  contact,
  items,
  editing,
}: FaqSplitProps) {
  // Render logic
  return (
    <div className="page-width grid grid-cols-1 gap-[2rem] text-left md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-[3.5rem]">
      <div className="flex flex-col items-start gap-[1rem]">
        {heading ? <h2 className="h2 text-balance text-[var(--color-ink)]">{heading}</h2> : null}
        <RichCopy value={text} className="text-body text-[var(--color-muted)]" />
        {contactHeading || contact?.label ? (
          <div className="mt-[0.5rem] flex flex-col items-start gap-[0.75rem] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[1.25rem]">
            {contactHeading ? (
              <p className="text-body font-semibold text-[var(--color-ink)]">{contactHeading}</p>
            ) : null}
            <KitButtons secondary={contact} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {(items ?? []).map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <details key={i} className="group" open={editing || undefined}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-[1rem] py-[1.125rem] text-body font-semibold text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <span className="shrink-0 text-[var(--color-muted)] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">
                <Icon name="chevron-down" size={16} />
              </span>
            </summary>
            <RichCopy
              value={item.answer}
              className="text-body pb-[1.125rem] text-[var(--color-muted)]"
            />
          </details>
        ))}
      </div>
    </div>
  )
}
