type Item = { quote: string; author: string; role: string }

type Props = { heading: string; items: Item[] }

// Port of the Glide testimonials block: quote cards with the author underneath.
export default function Testimonials({ heading, items }: Props) {
  return (
    <div className="testimonials page-width">
      {heading ? <h2 className="testimonials__heading h2">{heading}</h2> : null}
      <ul className="testimonials__list">
        {items.map((t, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <li key={`${t.author}-${i}`} className="testimonials__card">
            <blockquote className="testimonials__quote text-body">{t.quote}</blockquote>
            <p className="testimonials__author text-small">
              <strong>{t.author}</strong>
              {t.role ? <span className="text-caption">{t.role}</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
