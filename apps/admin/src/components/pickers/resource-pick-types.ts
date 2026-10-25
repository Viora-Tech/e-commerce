/** One row in the Browse picker: a product, collection, customer or segment. */
export type PickItem = {
  id: string
  title: string
  /** Second line under the title (a customer's email). */
  subtitle?: string | undefined
  /** Thumbnail; rows without one show the title's initial (customers, segments) or the image icon. */
  imageUrl?: string | null | undefined
  /** `image` draws ProductThumb (a missing picture shows the image icon); `initial` an avatar. */
  thumb?: 'image' | 'initial' | 'none' | undefined
  /** Right-hand detail: price and stock, a product count. */
  meta?: string | undefined
}

export type PickPage = { items: PickItem[]; total: number }

/** One tab of the picker and how it loads its rows, a page at a time. */
export type PickTab = {
  key: string
  label: string
  search: string
  empty: string
  load: (args: { page: number; search: string }) => Promise<PickPage>
}

/** What Done hands back: the tab the picks came from and the picked rows that were seen. */
export type PickResult = { tab: string; ids: string[]; items: PickItem[] }
