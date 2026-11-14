import type { ReactNode } from 'react'

type VariantPageColumnsProps = {
  /** The product's other variants: an 18rem list on desktop, a picker above the cards on a phone. */
  list: ReactNode
  main: ReactNode
}

/**
 * The variant page's two columns (Shopify's variant page): the variant list on the left, kept in
 * view while the cards scroll, and the variant's cards on the right, 1.5rem apart. The page and its
 * loading skeleton share it, so nothing moves when the variant arrives.
 */
export default function VariantPageColumns({ list, main }: VariantPageColumnsProps) {
  // Render logic
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <aside className="lg:sticky lg:top-4">{list}</aside>
      <div className="flex min-w-0 flex-col gap-6">{main}</div>
    </div>
  )
}
