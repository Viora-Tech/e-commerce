import { CircleCheck } from '@commerce/ui/icons'
import Image from 'next/image'
import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'

const copy = homeContent.india.payments

export default function PaymentsTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      className="min-h-[34rem] lg:col-span-2 lg:min-h-[39rem]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background">
        <Image
          src="/images/checkout-tile.png"
          alt={copy.alt}
          width={736}
          height={430}
          className="h-auto w-full"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-card to-transparent"
        />
        <p
          aria-hidden
          className="glass-panel absolute inset-x-0 bottom-5 mx-auto flex w-fit translate-y-3 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground opacity-0 transition-[opacity,translate] duration-500 ease-(--ease-out) group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none"
        >
          <CircleCheck className="size-4 text-success" />
          {copy.confirmed}
        </p>
      </div>
      <ul className="mt-5 flex gap-2">
        {copy.methods.map((method) => (
          <li
            key={method}
            className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {method}
          </li>
        ))}
      </ul>
    </BentoTile>
  )
}
