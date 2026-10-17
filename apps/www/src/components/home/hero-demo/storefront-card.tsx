import { CircleCheck, ReceiptIcon, Truck_ as Truck } from '@commerce/ui/icons'
import { demoStoreContent as copy, type DemoStore } from '@/data/demo-store'
import { formatInr } from '@/lib/pricing-math'
import TiltCard from '../../common/tilt-card'

type StorefrontCardProps = { store: DemoStore }

const BLOCK = 'group-data-[armed=true]/demo:opacity-0'

/**
 * The made-up storefront the hero builds from what was typed: header, hero tile, three products and
 * a UPI button, then the three India-first notices. The parts carry `data-*` hooks the sequence
 * animates; with no JS or reduced motion it is simply the finished store.
 */
export default function StorefrontCard({ store }: StorefrontCardProps) {
  return (
    <>
      <TiltCard>
        <div
          data-card
          className={`glass-panel relative flex flex-col gap-3 rounded-2xl p-3 ${BLOCK}`}
        >
          <svg
            data-outline
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
          />
          <div data-block className={`flex items-center justify-between px-1 ${BLOCK}`}>
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="grid size-6 place-items-center rounded-md bg-foreground text-xs font-bold text-background">
                {store.name.charAt(0)}
              </span>
              {store.name}
            </span>
            <span aria-hidden className="flex gap-1">
              <span className="size-1 rounded-full bg-muted-foreground" />
              <span className="size-1 rounded-full bg-muted-foreground" />
              <span className="size-1 rounded-full bg-muted-foreground" />
            </span>
          </div>
          <div
            data-block
            className={`flex aspect-[16/8] flex-col justify-end gap-1 rounded-xl bg-gradient-to-br p-3 ${store.heroTone} ${BLOCK}`}
          >
            <span className="w-fit rounded-full bg-background/70 px-2 py-0.5 text-[0.625rem] font-medium text-foreground">
              {copy.heroTile}
            </span>
            <span className="text-sm font-semibold text-white">{store.tagline}</span>
          </div>
          <ul className="grid grid-cols-3 gap-2">
            {store.products.map((product, index) => (
              <li key={product.name} data-block className={`flex flex-col gap-1 ${BLOCK}`}>
                <span
                  aria-hidden
                  className={`aspect-square rounded-lg bg-gradient-to-br ${store.tones[index]}`}
                />
                <span className="truncate text-[0.6875rem] font-medium text-foreground">
                  {product.name}
                </span>
                <span className="text-[0.6875rem] text-muted-foreground">
                  {formatInr(product.price)}
                </span>
              </li>
            ))}
          </ul>
          <span
            data-block
            className={`flex h-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background ${BLOCK}`}
          >
            {copy.payUpi}
          </span>
        </div>
      </TiltCard>
      <ul className="mt-3 flex flex-col gap-2 md:absolute md:top-0 md:left-full md:mt-0 md:ml-3 md:w-64 xl:static xl:mt-3 xl:ml-0 xl:w-auto">
        <li
          data-notice
          className={`glass-panel flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-foreground ${BLOCK}`}
        >
          <CircleCheck aria-hidden className="size-4 text-success" />
          {copy.upiPaid(formatInr(store.firstPrice), store.city)}
        </li>
        <li
          data-notice
          className={`glass-panel flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-foreground ${BLOCK}`}
        >
          <ReceiptIcon aria-hidden className="size-4" />
          {copy.gstInvoice}
          <CircleCheck aria-hidden data-tick className="ml-auto size-4 text-success" />
        </li>
        <li
          data-notice
          className={`glass-panel flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-foreground ${BLOCK}`}
        >
          <Truck aria-hidden className="size-4" />
          {copy.shipped}
        </li>
      </ul>
    </>
  )
}
