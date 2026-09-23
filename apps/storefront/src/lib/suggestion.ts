/** One product in the header's predictive search, as `/api/search/suggest` returns it. */
export type Suggestion = {
  handle: string
  title: string
  vendor: string | null
  pricePaise: number
  mrpPaise: number | null
  available: boolean
  image: { url: string; alt: string | null } | null
}
