import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'

const copy = homeContent.india.gst
const { invoice } = copy

type AmountRowProps = { label: string; amount: string; strong?: boolean }

function AmountRow({ label, amount, strong = false }: AmountRowProps) {
  return (
    <div
      className={`flex justify-between text-sm ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
    >
      <span>{label}</span>
      <span className="text-foreground">{amount}</span>
    </div>
  )
}

export default function GstTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      className="min-h-[34rem] lg:min-h-[39rem]"
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="group-hover:animate-print flex flex-col gap-3 bg-background p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{invoice.title}</span>
            <span className="text-xs text-muted-foreground">{invoice.number}</span>
          </div>
          <p className="text-xs text-muted-foreground">{invoice.gstin}</p>
          <p className="text-xs text-foreground">{invoice.item}</p>
          <hr className="border-border" />
          <p className="text-eyebrow">{invoice.inState}</p>
          <AmountRow label={invoice.taxable} amount={invoice.taxableAmount} />
          <AmountRow label={invoice.cgst.label} amount={invoice.cgst.amount} />
          <AmountRow label={invoice.sgst.label} amount={invoice.sgst.amount} />
          <hr className="border-border" />
          <p className="text-eyebrow">{invoice.outState}</p>
          <AmountRow label={invoice.taxable} amount={invoice.taxableAmount} />
          <AmountRow label={invoice.igst.label} amount={invoice.igst.amount} />
          <hr className="border-border" />
          <AmountRow label={invoice.total} amount={invoice.totalAmount} strong />
        </div>
      </div>
      <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
        {copy.badge}
      </p>
    </BentoTile>
  )
}
