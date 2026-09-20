import { HeroCarousel, type HeroSlide } from '@/components/glide/hero-carousel'
import { TabbedProducts } from '@/components/glide/product-grid'
import { SectionFrame } from '@/components/glide/section-frame'
import { listCardProducts } from '@/lib/catalog'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export default async function Home({ params }: Params) {
  const { storeId } = await params
  const products = await inStore(storeId, (tx) => listCardProducts(tx, 120))

  const byType = new Map<string, typeof products>()
  for (const p of products) {
    const key = p.productType ?? 'Other'
    byType.set(key, [...(byType.get(key) ?? []), p])
  }
  const tabs = [...byType.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([label, items]) => ({ label, products: items.slice(0, 8) }))

  const heroPicks = products.filter((p) => p.images.length > 0 && p.mrpPaise).slice(0, 3)
  const slides: HeroSlide[] = heroPicks.map((p, i) => ({
    heading: i === 0 ? 'Glide faster' : p.title,
    subheading:
      i === 0
        ? "India's glasspad specialist. Tested on real desks, shipped from Sonipat."
        : `${p.vendor ?? 'Waimers'} · now ${Math.round((1 - p.pricePaise / (p.mrpPaise ?? p.pricePaise)) * 100)}% off`,
    image: { url: p.images[0]?.url ?? '', alt: p.title },
    cta: {
      label: i === 0 ? 'Shop glasspads' : 'View product',
      href: i === 0 ? '/collections/glass-mousepads' : `/products/${p.handle}`,
    },
    ...(i === 0 ? { cta2: { label: 'Find my match', href: '/guides' } } : {}),
    textPosition: i === 1 ? ('right' as const) : ('left' as const),
  }))

  return (
    <>
      <HeroCarousel slides={slides} />
      <SectionFrame scheme="scheme-5" padTop={56} padBottom={56}>
        <TabbedProducts heading="Shop the range" tabs={tabs} />
      </SectionFrame>
    </>
  )
}
