import { Pencil } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import KitButton from '@/components/kit/kit-button'
import KitCategoryRow from '@/components/kit/kit-category-row'
import KitProductRow from '@/components/kit/kit-product-row'
import { homeContent } from '@/data/home'
import { formatPaise } from '@/lib/money'

type Category = { type: string; count: number; imageUrl: string | null }
type LatestProduct = {
  productId: string
  title: string
  pricePaise: number
  imageUrl: string | null
}

type QuickAddCardProps = {
  categories: Category[]
  products: LatestProduct[]
}

/** The products list searches title, type and vendor, so the type name lands on that group. */
const productsHref = (type: string) => `/products?query=${encodeURIComponent(type)}`

/**
 * Sheet 14:910 "Add New Product" (292 x 420, 20px inset): 18/700 title with a 12px green
 * "Add New" link, "Categories" label, three 46px category rows on 1 Ambient cards, a centred
 * "See more", then "Product" rows with price and a green "Add" pill. Ours groups by product
 * type and lists the newest products; the pill opens the product since it already exists.
 */
export default function QuickAddCard({ categories, products }: QuickAddCardProps) {
  // Render logic
  const c = homeContent.quickAdd

  return (
    <Card className="h-full gap-0 p-5">
      <div className="flex items-center justify-between">
        <p className="text-kit-title text-foreground">{c.title}</p>
        <KitButton variant="linkSm" href="/products/new">
          {c.addNew}
        </KitButton>
      </div>
      <p className="mt-3 text-kit-body text-muted-foreground">{c.categories}</p>
      {categories.length === 0 ? (
        <p className="mt-2 text-kit-body text-muted-foreground">{c.emptyCategories}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {categories.map((cat) => (
            <KitCategoryRow
              key={cat.type}
              href={productsHref(cat.type)}
              image={cat.imageUrl}
              label={cat.type}
              count={c.count(cat.count)}
            />
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-center">
        <KitButton variant="linkSm" href="/products">
          {c.seeMore}
        </KitButton>
      </div>
      <p className="mt-4 text-kit-body text-muted-foreground">{c.products}</p>
      {products.length === 0 ? (
        <p className="mt-2 text-kit-body text-muted-foreground">{c.emptyProducts}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {products.map((p) => (
            <KitProductRow
              key={p.productId}
              image={p.imageUrl}
              title={p.title}
              price={formatPaise(p.pricePaise)}
              action={{ label: c.edit, href: `/products/${p.productId}`, icon: Pencil }}
            />
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-center">
        <KitButton variant="linkSm" href="/products">
          {c.seeMore}
        </KitButton>
      </div>
    </Card>
  )
}
