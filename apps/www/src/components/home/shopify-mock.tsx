import { cn } from '@commerce/ui/lib/utils'
import { homeContent } from '@/data/home'

type ShopifyMockProps = { variant: 'before' | 'after'; className?: string }

const { shopify } = homeContent

/** The same demo store shown twice: on Shopify, then on the platform, to show the look is kept. */
export default function ShopifyMock({ variant, className }: ShopifyMockProps) {
  const side = variant === 'before' ? shopify.before : shopify.after

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="surface-glass w-full overflow-hidden rounded-2xl bg-card">
        <div className="flex h-9 items-center gap-1.5 bg-muted/60 px-3">
          <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
          <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
          <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
          <span className="ml-3 truncate font-mono text-xs text-muted-foreground">{side.url}</span>
        </div>
        <div className="flex flex-col gap-3 bg-muted/40 p-6">
          <p className="font-mono text-xs font-medium text-foreground">{shopify.store.name}</p>
          <p className="text-2xl font-semibold text-foreground">{shopify.store.headline}</p>
          <span className="inline-flex h-8 w-fit items-center rounded-md bg-muted px-3 text-sm font-medium text-foreground">
            {shopify.store.cta}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-3 p-4">
          {shopify.store.products.map((product) => (
            <li key={product.name} className="flex flex-col gap-1 text-xs">
              <span
                aria-hidden
                className="aspect-[3/2] rounded-md bg-gradient-to-br from-muted to-secondary"
              />
              <span className="mt-1 truncate text-foreground">{product.name}</span>
              <span className="text-muted-foreground">{product.price}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-muted-foreground">{side.caption}</p>
    </div>
  )
}
