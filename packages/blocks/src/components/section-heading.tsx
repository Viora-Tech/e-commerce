// Port of snippets/section-heading.liquid.
export default function SectionHeading({
  kicker,
  heading,
  viewAll,
}: {
  kicker?: string
  heading: string
  viewAll?: { href: string; label: string }
}) {
  return (
    <div className="section-heading">
      <div className="section-heading__text">
        {kicker ? <p className="section-heading__kicker text-caption">{kicker}</p> : null}
        <h2 className="section-heading__title h2">{heading}</h2>
      </div>
      {viewAll ? (
        <a href={viewAll.href} className="section-heading__view-all">
          {viewAll.label}
        </a>
      ) : null}
    </div>
  )
}
