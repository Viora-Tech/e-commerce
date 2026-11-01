/** Switching markets: the "Shopping from …?" suggestion shown to visitors from another market's country. */
export const marketSuggestionContent = {
  label: 'Shopping region',
  question: (country: string) => `Shopping from ${country}?`,
  body: (currency: string) => `See prices in ${currency} and shop in your own market.`,
  switch: (currency: string) => `Shop in ${currency}`,
  stay: (currency: string) => `Stay in ${currency}`,
  close: 'Close',
}
