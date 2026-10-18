/** Fixed strings on the product card (Figma Store / Product card). */
export const productCardContent = {
  quickAdd: 'Quick add',
  chooseOptions: 'Choose options',
  added: 'Added to cart',
  failed: 'Try again',
  soldOut: 'Sold out',
  save: (title: string) => `Save ${title} to your wishlist`,
  unsave: (title: string) => `Remove ${title} from your wishlist`,
} as const
