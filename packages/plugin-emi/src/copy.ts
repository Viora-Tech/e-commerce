/** Shopper-facing copy for the EMI & pay later block. Never inline this in the block. */
export const emiOffersCopy = {
  label: (monthly: string) => `or ${monthly}/month with EMI or pay later`,
  detail: 'Pick EMI or pay later at checkout. Your bank or lender decides the final plan.',
} as const
