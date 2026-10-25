import { paymentDemoContent } from '@/data/demo-payments'

const copy = paymentDemoContent.summary

/** The order the payments demo is paying for, beside the method picker on wider screens. */
export default function OrderSummaryCard() {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5">
      <p className="text-sm font-semibold text-foreground">{copy.heading}</p>
      <div className="flex items-center gap-3">
        {/* biome-ignore lint/performance/noImgElement: static export, images are unoptimized */}
        <img
          src={copy.image}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          className="size-14 shrink-0 rounded-lg border border-border bg-muted object-cover"
        />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm text-foreground">{copy.item}</p>
          <p className="text-xs text-muted-foreground">{copy.quantity}</p>
        </div>
      </div>
      <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
        {copy.rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-end justify-between gap-2 border-t border-border pt-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{copy.total.label}</p>
          <p className="text-xs text-muted-foreground">{copy.total.note}</p>
        </div>
        <p className="text-xl font-semibold text-foreground">{copy.total.value}</p>
      </div>
      <p className="mt-auto text-xs text-muted-foreground">{copy.secure}</p>
    </aside>
  )
}
