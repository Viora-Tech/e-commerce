import type { ReactNode } from 'react'
import RichCopy from '../rich-copy'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Item = { question: ReactNode; answer: ReactNode }

type Props = {
  heading: ReactNode
  items: Item[]
  /** On the Customize canvas every answer is open, so it can be clicked and edited. */
  editing?: boolean | undefined
}

// Port of sections/collapsible-content.liquid: native disclosure rows, no script.
export default function Faq({ heading, items, editing = false }: Props) {
  return (
    <div className="faq page-width">
      {heading ? <h2 className="faq__heading h2">{heading}</h2> : null}
      <div className="faq__list">
        {items.map((q, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <details key={i} className="faq__item" open={editing || undefined}>
            <summary className="faq__question h5">{q.question}</summary>
            <RichCopy value={q.answer} className="faq__answer text-body" />
          </details>
        ))}
      </div>
    </div>
  )
}
