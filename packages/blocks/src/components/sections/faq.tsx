type Item = { question: string; answer: string }

type Props = { heading: string; items: Item[] }

// Port of sections/collapsible-content.liquid: native disclosure rows, no script.
export default function Faq({ heading, items }: Props) {
  return (
    <div className="faq page-width">
      {heading ? <h2 className="faq__heading h2">{heading}</h2> : null}
      <div className="faq__list">
        {items.map((q, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <details key={`${q.question}-${i}`} className="faq__item">
            <summary className="faq__question h5">{q.question}</summary>
            <p className="faq__answer text-body">{q.answer}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
