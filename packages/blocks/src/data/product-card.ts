/** Fixed strings on the product card (Figma Store / Product card). */
export const productCardContent = {
  quickAdd: 'Quick add',
  chooseOptions: 'Choose options',
  added: 'Added to cart',
  failed: 'Try again',
  soldOut: 'Sold out',
  /** Badge on a card still selling as a pre-order once stock runs out. */
  preorder: 'Pre-order',
  save: (title: string) => `Save ${title} to your wishlist`,
  unsave: (title: string) => `Remove ${title} from your wishlist`,
} as const
