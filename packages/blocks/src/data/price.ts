/** Fixed strings on the price line (snippets/price.liquid). */
export const priceContent = {
  /** Shown in place of the price while the merchant has not set one yet; the item cannot be bought. */
  comingSoon: 'Price coming soon',
  /** A card whose variants cost different amounts: the lowest (Markets › Catalogs). */
  from: (price: string) => `From ${price}`,
  /** The saving beside the struck-through MRP. */
  save: (amount: string) => `Save ${amount}`,
} as const
