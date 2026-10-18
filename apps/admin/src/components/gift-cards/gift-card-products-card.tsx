import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { giftCardProductsContent as copy } from '@/data/gift-cards'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'

type GiftCardProduct = {
  id: string
  title: string
  status: 'draft' | 'active' | 'archived'
  denominationsPaise: number[]
}

type GiftCardProductsCardProps = {
  products: GiftCardProduct[]
  onAdd: () => void
}

/** The gift card products shoppers can buy, each linking to its product page. */
export default function GiftCardProductsCard({ products, onAdd }: GiftCardProductsCardProps) {
  return (
    <DataCard
      title={copy.heading}
      subtitle={copy.help}
      action={
        <Button variant="outline" size="sm" onClick={onAdd}>
          {copy.add}
        </Button>
      }
    >
      {products.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={routes.products.detail(p.id)}
                className="flex items-center justify-between gap-3 py-3 hover:text-link"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-strong">{p.title}</span>
                  <span className="truncate text-caption text-muted-foreground tabular-nums">
                    {p.denominationsPaise.map((d) => formatPaise(d)).join(', ')}
                  </span>
                </span>
                <StatusLabel kind="product" value={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
