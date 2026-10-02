/** SOURCE OF TRUTH: synchronous data for Liquid renders — WHAT: a per-request cache in front of `LiquidDataSource`; a render reads it synchronously, a value not loaded yet reads as blank and is noted, then the cache loads every noted value at once and the section renders again / WHY: rendering with promises (LiquidJS async mode) creates tens of thousands of promises per page, which React's development server tracks one by one (20 s home pages); a synchronous render with a few batched loads between passes is fast everywhere and keeps database reads per request the same */
import type {
  LiquidBlogData,
  LiquidCollectionData,
  LiquidDataSource,
  LiquidMenuData,
  LiquidPageData,
  LiquidProductData,
} from './drops'

/** How many products a collection hands a theme at once (Shopify pages at 50). */
const COLLECTION_PAGE_SIZE = 50

type Store<T> = Map<string, T | null>

export class LiquidDataCache {
  readonly source: LiquidDataSource
  readonly #products: Store<LiquidProductData> = new Map()
  readonly #collections: Store<LiquidCollectionData> = new Map()
  readonly #collectionProducts: Store<LiquidProductData[]> = new Map()
  readonly #menus: Store<LiquidMenuData> = new Map()
  readonly #blogs: Store<LiquidBlogData> = new Map()
  readonly #pages: Store<LiquidPageData> = new Map()
  readonly #pending = new Map<string, () => Promise<void>>()
  /** Every collection, titles and images only, in title order (`{% for c in collections %}`). */
  readonly collectionList: LiquidCollectionData[]

  constructor(source: LiquidDataSource, collectionList: LiquidCollectionData[]) {
    this.source = source
    this.collectionList = collectionList
    for (const c of collectionList) this.#collections.set(c.handle, c)
  }

  /** The value when loaded; otherwise notes it for the next `fill` and reads as missing. */
  #read<T>(store: Store<T>, kind: string, key: string, load: () => Promise<T | null>): T | null {
    if (store.has(key)) return store.get(key) ?? null
    const id = `${kind}:${key}`
    if (!this.#pending.has(id)) {
      this.#pending.set(id, async () => {
        store.set(key, await load())
      })
    }
    return null
  }

  product(handle: string): LiquidProductData | null {
    return this.#read(this.#products, 'p', handle, () => this.source.product(handle))
  }

  collection(handle: string): LiquidCollectionData | null {
    return this.#read(this.#collections, 'c', handle, () => this.source.collection(handle))
  }

  collectionProducts(handle: string): LiquidProductData[] | null {
    return this.#read(this.#collectionProducts, 'cp', handle, () =>
      this.source.collectionProducts(handle, COLLECTION_PAGE_SIZE),
    )
  }

  menu(handle: string): LiquidMenuData | null {
    return this.#read(this.#menus, 'm', handle, () => this.source.menu(handle))
  }

  blog(handle: string): LiquidBlogData | null {
    return this.#read(this.#blogs, 'b', handle, () => this.source.blog(handle))
  }

  page(handle: string): LiquidPageData | null {
    return this.#read(this.#pages, 'pg', handle, () => this.source.page(handle))
  }

  /** True when the last render asked for something not loaded yet. */
  get missing(): boolean {
    return this.#pending.size > 0
  }

  /** Loads everything the last render asked for. One at a time: a transaction runs one query at once anyway. */
  async fill(): Promise<void> {
    const jobs = [...this.#pending.values()]
    this.#pending.clear()
    for (const job of jobs) await job()
  }
}
