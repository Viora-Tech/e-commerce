import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import StatusLabel from '@/components/status/status-label'
import { giftCardProductsContent as copy } from '@/data/gift-cards'
import { formatPaise } from '@/lib/money'

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
    <Card className="gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-card-title text-foreground">{copy.heading}</p>
          <p className="text-caption text-muted-foreground">{copy.help}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          {copy.add}
        </Button>
      </div>
      {products.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/products/${p.id}`}
                className="flex items-center justify-between gap-3 py-3 hover:text-link"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-strong">{p.title}</span>
                  <span className="truncate text-caption text-muted-foreground tabular-nums">
                    {p.denominationsPaise.map((d) => formatPaise(d)).join(', ')}
                  </span>
                </span>
                <StatusLabel kind="product" value={p.status} variant="pill" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
