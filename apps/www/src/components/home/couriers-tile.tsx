import { Truck_ as Truck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { homeContent } from '@/data/home'
import BrandLogo from '../common/brand-logo'
import BentoTile from './bento-tile'

const copy = homeContent.india.couriers

export default function CouriersTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      layout="side"
      className="md:col-span-2"
    >
      <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-foreground md:absolute md:top-7 md:left-7 md:mb-0">
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground" />
        {copy.badge}
      </p>
      <ul className="flex flex-col gap-2">
        {copy.options.map((option) => (
          <li
            key={option.code}
            className={cn(
              'group/logo flex items-center gap-3 rounded-xl border bg-background px-4 py-3 sm:gap-4',
              option.selected ? 'border-foreground' : 'border-border',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-3.5 shrink-0 rounded-full border',
                option.selected ? 'border-foreground bg-foreground' : 'border-border-strong',
              )}
            />
            {/* The name already says the courier, so phones drop the logo to keep the price in view. */}
            <span className="hidden w-28 shrink-0 justify-start sm:flex">
              <BrandLogo brand={option.brand} className="-ml-2" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {option.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{option.eta}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-lg font-semibold text-foreground">{option.price}</span>
              <span className="block text-xs text-muted-foreground">{copy.inclGst}</span>
            </span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{copy.route}</span>
        <span className="relative h-6 flex-1 [container-type:inline-size]">
          <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border-strong" />
          <Truck className="absolute top-0 left-0 size-6 rounded-md bg-card p-1 text-foreground transition-transform duration-[1400ms] ease-(--ease-in-out) group-hover:translate-x-[calc(100cqw-1.5rem)] motion-reduce:transition-none" />
        </span>
      </div>
    </BentoTile>
  )
}
