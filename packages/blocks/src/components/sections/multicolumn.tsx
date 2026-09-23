type Column = { title: string; text: string; image?: { url: string; alt: string } | undefined }

type Props = { heading: string; columns: Column[] }

// Port of sections/multicolumn.liquid: a row of short feature columns.
export default function Multicolumn({ heading, columns }: Props) {
  return (
    <div className="multicolumn page-width">
      {heading ? <h2 className="multicolumn__heading h2">{heading}</h2> : null}
      <ul className="multicolumn__list">
        {columns.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <li key={`${c.title}-${i}`} className="multicolumn__item">
            {c.image?.url ? (
              <img
                className="multicolumn__image"
                src={c.image.url}
                alt={c.image.alt}
                loading="lazy"
              />
            ) : null}
            <h3 className="h4">{c.title}</h3>
            <p className="text-body">{c.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
