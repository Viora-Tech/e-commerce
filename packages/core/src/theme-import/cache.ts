/** SOURCE OF TRUTH: synchronous data for Liquid renders — WHAT: a per-request cache in front of `LiquidDataSource` (catalogue, menus, blogs, pages, extra fields and content entries); a render reads it synchronously, a value not loaded yet reads as blank and is noted, then the cache loads every noted value at once and the section renders again / WHY: rendering with promises (LiquidJS async mode) creates tens of thousands of promises per page, which React's development server tracks one by one (20 s home pages); a synchronous render with a few batched loads between passes is fast everywhere and keeps database reads per request the same */
import type {
  LiquidBlogData,
  LiquidCollectionData,
  LiquidCustomData,
  LiquidDataSource,
  LiquidMenuData,
  LiquidMetafieldData,
  LiquidMetafieldOwner,
  LiquidMetaobjectData,
  LiquidPageData,
  LiquidProductData,
} from './drops'

/** How many products a collection hands a theme at once (Shopify pages at 50). */
const COLLECTION_PAGE_SIZE = 50

type Store<T> = Map<string, T | null>

export class LiquidDataCache {
  readonly source: LiquidDataSource
  readonly #products: Store<LiquidProductData> = new Map()
  readonly #wantProducts = new Set<string>()
  readonly #wantCollections = new Set<string>()
  readonly #collections: Store<LiquidCollectionData> = new Map()
  readonly #collectionProducts: Store<LiquidProductData[]> = new Map()
  readonly #menus: Store<LiquidMenuData> = new Map()
  readonly #blogs: Store<LiquidBlogData> = new Map()
  readonly #pages: Store<LiquidPageData> = new Map()
  /** `owner:id` → that owner's extra fields (empty when it has none). */
  readonly #metafields = new Map<string, LiquidMetafieldData[]>()
  readonly #wantMetafields: Record<LiquidMetafieldOwner, Set<string>> = {
    product: new Set(),
    collection: new Set(),
  }
  /** Entry id → the entry; null when it is hidden, a draft or gone. */
  readonly #entries = new Map<string, LiquidMetaobjectData | null>()
  readonly #wantEntries = new Set<string>()
  /** Content type → its entries' ids, in order. */
  readonly #types: Store<string[]> = new Map()
  readonly #pending = new Map<string, () => Promise<void>>()
  /** Judge.me's shop data from the Reviews app (one value per request). */
  readonly #judgeme: Store<Record<string, unknown>> = new Map()
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

  /** Products asked for in one pass load together when the source can (`products`). */
  product(handle: string): LiquidProductData | null {
    const batch = this.source.products
    if (!batch) return this.#read(this.#products, 'p', handle, () => this.source.product(handle))
    if (this.#products.has(handle)) return this.#products.get(handle) ?? null
    this.#wantProducts.add(handle)
    if (!this.#pending.has('p*')) {
      this.#pending.set('p*', async () => {
        const handles = [...this.#wantProducts]
        this.#wantProducts.clear()
        const found = await batch(handles)
        for (const h of handles) this.#products.set(h, found.get(h) ?? null)
      })
    }
    return null
  }

  collection(handle: string): LiquidCollectionData | null {
    return this.#read(this.#collections, 'c', handle, () => this.source.collection(handle))
  }

  /** Collections asked for in one pass load together when the source can (`collectionsProducts`). */
  collectionProducts(handle: string): LiquidProductData[] | null {
    const batch = this.source.collectionsProducts
    if (!batch) {
      return this.#read(this.#collectionProducts, 'cp', handle, () =>
        this.source.collectionProducts(handle, COLLECTION_PAGE_SIZE),
      )
    }
    if (this.#collectionProducts.has(handle)) return this.#collectionProducts.get(handle) ?? null
    this.#wantCollections.add(handle)
    if (!this.#pending.has('cp*')) {
      this.#pending.set('cp*', async () => {
        const handles = [...this.#wantCollections]
        this.#wantCollections.clear()
        const found = await batch(handles, COLLECTION_PAGE_SIZE)
        for (const h of handles) this.#collectionProducts.set(h, found.get(h) ?? [])
      })
    }
    return null
  }

  menu(handle: string): LiquidMenuData | null {
    return this.#read(this.#menus, 'm', handle, () => this.source.menu(handle))
  }

  blog(handle: string): LiquidBlogData | null {
    return this.#read(this.#blogs, 'b', handle, () => this.source.blog(handle))
  }

  /** `shop.metafields.judgeme`: the Reviews app's data in Judge.me's shape, or null without it. */
  judgeme(): Record<string, unknown> | null {
    return this.#read(
      this.#judgeme,
      'jm',
      'shop',
      async () => (await this.source.judgeme?.()) ?? null,
    )
  }

  page(handle: string): LiquidPageData | null {
    return this.#read(this.#pages, 'pg', handle, () => this.source.page(handle))
  }

  /** Keeps the entries a custom-data load brought back, so links between them read at once. */
  #absorb(data: LiquidCustomData) {
    for (const e of data.entries) this.#entries.set(e.id, e)
  }

  /**
   * An owner's extra fields. Every owner asked for in one pass is loaded in one batch
   * per owner type, so a grid of 50 product cards costs one query, not 50.
   */
  metafields(ownerType: LiquidMetafieldOwner, ownerId: string): LiquidMetafieldData[] | null {
    const key = `${ownerType}:${ownerId}`
    const hit = this.#metafields.get(key)
    if (hit) return hit
    const want = this.#wantMetafields[ownerType]
    want.add(ownerId)
    const job = `mf:${ownerType}`
    if (!this.#pending.has(job)) {
      this.#pending.set(job, async () => {
        const ids = [...want]
        want.clear()
        const data = await this.source.metafields(ownerType, ids)
        this.#absorb(data)
        for (const id of ids) this.#metafields.set(`${ownerType}:${id}`, data.metafields[id] ?? [])
      })
    }
    return null
  }

  /** One published entry by id (batched like `metafields`); null while loading or when hidden. */
  metaobject(id: string): LiquidMetaobjectData | null {
    if (this.#entries.has(id)) return this.#entries.get(id) ?? null
    this.#wantEntries.add(id)
    if (!this.#pending.has('mo')) {
      this.#pending.set('mo', async () => {
        const ids = [...this.#wantEntries]
        this.#wantEntries.clear()
        const data = await this.source.metaobjects(ids)
        this.#absorb(data)
        for (const id of ids) if (!this.#entries.has(id)) this.#entries.set(id, null)
      })
    }
    return null
  }

  /** Every published entry of a content type, in order. */
  metaobjectType(type: string): LiquidMetaobjectData[] | null {
    const ids = this.#read(this.#types, 'mt', type, async () => {
      const data = await this.source.metaobjectsOfType(type)
      this.#absorb(data)
      return data.entries.filter((e) => e.type === type).map((e) => e.id)
    })
    return ids ? ids.flatMap((id) => this.#entries.get(id) ?? []) : null
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
