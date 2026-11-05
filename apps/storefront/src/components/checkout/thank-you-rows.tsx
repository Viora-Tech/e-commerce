type ThankYouRowsProps = {
  rows: readonly (readonly [string, string])[]
}

/** Label on the left, value on the right: the facts of a payment. */
export default function ThankYouRows({ rows }: ThankYouRowsProps) {
  return (
    <dl className="m-0! flex flex-col gap-2 text-[0.875rem] leading-5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="text-ck-muted">{label}</dt>
          <dd className="m-0! text-right font-medium text-ck-ink [overflow-wrap:anywhere]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
