import type { Metadata } from 'next'
import WishlistGrid from '@/components/wishlist/wishlist-grid'
import { wishlistContent as copy } from '@/data/wishlist'

export const metadata: Metadata = {
  title: copy.title,
  robots: { index: false, follow: true },
}

/** The products this shopper saved with the heart, kept on their device. */
export default function WishlistPage() {
  return (
    <section className="wishlist page-width">
      <h1 className="section-title">{copy.title}</h1>
      <WishlistGrid />
    </section>
  )
}
