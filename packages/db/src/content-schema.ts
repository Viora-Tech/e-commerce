import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/* Storefront content the merchant edits: URL redirects, builder pages and menus. */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/**
 * A 301 from an old storefront path to a new destination, Shopify style. `path`
 * is normalised (lowercase, leading slash, no trailing slash, no query) so the
 * storefront can look it up by equality; `target` is a path or an absolute URL.
 */
export const urlRedirect = pgTable(
  'url_redirect',
  {
    id: id(),
    storeId: storeId(),
    path: text('path').notNull(),
    target: text('target').notNull(),
    /**
     * `import` rows came from a store migration, `auto` ones when a product, collection or page
     * handle changed; the merchant can edit any of them.
     */
    source: text('source', { enum: ['manual', 'import', 'auto'] })
      .notNull()
      .default('manual'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('url_redirect_store_path').on(t.storeId, t.path)],
)

/** Builder pages. `data` is the draft (Puck JSON); `publishedData` is what the storefront renders. */
export const page = pgTable(
  'page',
  {
    id: id(),
    storeId: storeId(),
    handle: text('handle').notNull(),
    title: text('title').notNull(),
    /** Page content (Lexical JSON), rendered by the template's Main page section. */
    body: jsonb('body'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    /** Alternate page template (`page.<suffix>`); null uses the default page template. */
    templateSuffix: text('template_suffix'),
    /** Legacy Puck layout from before theme templates; kept read-only for rollback. */
    data: jsonb('data').notNull(),
    publishedData: jsonb('published_data'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('page_store_handle').on(t.storeId, t.handle)],
)

export type NavigationItemType =
  | 'home'
  | 'product'
  | 'collection'
  | 'page'
  | 'blog'
  | 'article'
  | 'policy'
  | 'search'
  | 'collections'
  | 'url'

/** One entry in a storefront menu, kept in order inside navigation_menu.items. */
export type NavigationItem = {
  id: string
  title: string
  type: NavigationItemType
  /**
   * Handle for product/collection/page/blog, `blog-handle/article-handle` for an article, the
   * policy type (`refund-policy`) for a policy, the URL for url; absent for home, search and
   * collections (all collections).
   */
  value?: string | undefined
  /**
   * Nested items. A menu is at most three levels deep (top, dropdown, and the
   * grouped columns of a mega menu), the same ceiling Shopify sets.
   */
  children?: NavigationItem[] | undefined
}

/**
 * Storefront menus (header, footer). The storefront renders them later;
 * for now the admin owns the list and every item's destination.
 */
export const navigationMenu = pgTable(
  'navigation_menu',
  {
    id: id(),
    storeId: storeId(),
    title: text('title').notNull(),
    handle: text('handle').notNull(),
    items: jsonb('items').$type<NavigationItem[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('navigation_menu_store_handle').on(t.storeId, t.handle)],
)
