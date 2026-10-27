import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/* Metaobjects (custom content types) and metafields (extra fields on products, customers, …). */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/**
 * Value types shared by metaobject fields and product/collection metafields. Plain text in
 * the database (no CHECK), validated by @commerce/core, which documents each value's shape.
 */
export const METAFIELD_TYPES = [
  'single_line_text',
  'multi_line_text',
  'rich_text',
  'number_integer',
  'number_decimal',
  'boolean',
  'date',
  'url',
  'file',
  'product_reference',
  'collection_reference',
  'metaobject_reference',
  'color',
  'date_time',
  'money',
  'choice',
  'link',
  'rating',
  'measurement',
  'page_reference',
  'variant_reference',
  'article_reference',
  'group',
] as const
export type MetafieldType = (typeof METAFIELD_TYPES)[number]

/** One field of a metaobject definition. Validated by @commerce/core metaobject schemas. */
export type MetaobjectFieldDefinition = {
  key: string
  name: string
  type: MetafieldType
  list: boolean
  required: boolean
  description?: string | undefined
  /** Type-specific rules: min/max, choices, max length, referenced definition id. */
  validations?: Record<string, unknown> | undefined
}

/** A custom content type (Shopify's metaobject definition); `type` is its handle. */
export const metaobjectDefinition = pgTable(
  'metaobject_definition',
  {
    id: id(),
    storeId: storeId(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** Field key whose value names an entry in lists and pickers. */
    displayNameKey: text('display_name_key'),
    fields: jsonb('fields').$type<MetaobjectFieldDefinition[]>().notNull().default([]),
    /** Readable by the storefront data layer. */
    storefrontAccess: boolean('storefront_access').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metaobject_definition_store_type').on(t.storeId, t.type),
    check('metaobject_definition_type', sql`${t.type} ~ '^[a-z][a-z0-9_]{0,63}$'`),
  ],
)

/** One entry of a metaobject definition; `fields` maps field key to its typed value. */
export const metaobject = pgTable(
  'metaobject',
  {
    id: id(),
    storeId: storeId(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => metaobjectDefinition.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull(),
    fields: jsonb('fields').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status', { enum: ['draft', 'active'] })
      .notNull()
      .default('active'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metaobject_definition_handle').on(t.definitionId, t.handle),
    index('metaobject_store').on(t.storeId),
  ],
)

export type MetafieldOwnerType =
  | 'product'
  | 'variant'
  | 'collection'
  | 'customer'
  | 'order'
  | 'page'
  | 'article'
  | 'shop'

/**
 * A typed custom field ("extra field", `namespace.key`) on products, variants, collections,
 * customers, orders, pages, blog articles or the shop itself (owner id = the store's id).
 */
export const metafieldDefinition = pgTable(
  'metafield_definition',
  {
    id: id(),
    storeId: storeId(),
    ownerType: text('owner_type').$type<MetafieldOwnerType>().notNull(),
    namespace: text('namespace').notNull().default('custom'),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').$type<MetafieldType>().notNull(),
    list: boolean('list').notNull().default(false),
    validations: jsonb('validations').$type<Record<string, unknown>>().notNull().default({}),
    storefrontAccess: boolean('storefront_access').notNull().default(true),
    /** Offered as a filter on collection and search pages (product fields of simple types). */
    filterable: boolean('filterable').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metafield_definition_owner_key').on(t.storeId, t.ownerType, t.namespace, t.key),
    check(
      'metafield_definition_owner',
      sql`${t.ownerType} in ('product', 'variant', 'collection', 'customer', 'order', 'page', 'article', 'shop')`,
    ),
    check('metafield_definition_key', sql`${t.key} ~ '^[a-z][a-z0-9_]{0,63}$'`),
    check('metafield_definition_namespace', sql`${t.namespace} ~ '^[a-z][a-z0-9_]{0,63}$'`),
  ],
)

/** The value of one definition on one owner (product, customer, order, ... or the shop). */
export const metafield = pgTable(
  'metafield',
  {
    id: id(),
    storeId: storeId(),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => metafieldDefinition.id, { onDelete: 'cascade' }),
    ownerType: text('owner_type').$type<MetafieldOwnerType>().notNull(),
    ownerId: uuid('owner_id').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('metafield_definition_owner').on(t.definitionId, t.ownerId),
    index('metafield_owner').on(t.ownerType, t.ownerId),
  ],
)
