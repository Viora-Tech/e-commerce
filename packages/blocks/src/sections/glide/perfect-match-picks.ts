import { perfectMatchContent as copy } from '../../data/glide/perfect-match'
import type { CardProduct } from '../../types'

/** Port of the product resolution in sections/perfect-match.liquid. */
export type MatchPickInput = {
  /** Products the merchant picked by hand, in order. */
  curated: CardProduct[]
  /** Candidates of each category's collection, in category order. */
  categories: CardProduct[][]
  /** Candidates of the general collection. */
  pool: CardProduct[]
  /** Seconds since the epoch: the theme's "random" offset, so every visit sees another slice. */
  now: number
}

/** A product that can sit on the ring: in stock and with a picture. */
function isUsable(product: CardProduct): boolean {
  return product.available > 0 && Boolean(product.images[0]?.url)
}

/**
 * Hand-picked products first. The rest are filled one product per category (so the ring spans
 * the catalogue's range), then from the general pool. Never more than `maxProducts`, never
 * a product twice, never one that is out of stock or has no image.
 */
export function pickMatchProducts({
  curated,
  categories,
  pool,
  now,
}: MatchPickInput): CardProduct[] {
  const picks: CardProduct[] = []
  const used = new Set<string>()
  const add = (product: CardProduct | undefined) => {
    if (!product || !isUsable(product) || used.has(product.handle)) return
    used.add(product.handle)
    picks.push(product)
  }

  for (const product of curated) {
    if (picks.length >= copy.maxProducts) break
    add(product)
  }

  const open = copy.maxProducts - picks.length
  categories.slice(0, open).forEach((list, i) => {
    const eligible = list.filter(isUsable)
    if (eligible.length === 0) return
    const salt = copy.salts[i] ?? copy.salts[0]
    add(eligible[(now + salt) % eligible.length])
  })

  const eligiblePool = pool.filter(isUsable)
  if (picks.length < copy.maxProducts && eligiblePool.length > 0) {
    const start = (now + copy.poolSalt) % eligiblePool.length
    for (let i = 0; i < eligiblePool.length && picks.length < copy.maxProducts; i++) {
      add(eligiblePool[(start + i) % eligiblePool.length])
    }
  }
  return picks
}
