import { sql } from 'drizzle-orm'
import {
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

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/**
 * A store's themes, Shopify style: exactly one `main` theme is live on the
 * storefront; the rest are `unpublished` drafts in the theme library. `settings`
 * is the colours/typography/shape document validated by @commerce/core ThemeSchema.
 * Per-template section data (home, product, collection, page) belongs in its own
 * table keyed by theme id, not here.
 */
export const theme = pgTable(
  'theme',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    role: text('role').notNull().default('unpublished'),
    /** The preset it was created from; informational ("Based on Minimal"). */
    preset: text('preset'),
    settings: jsonb('settings').notNull(),
    /** A small webp of the home page, taken in Customize on Save; null until the first one. */
    thumbnailUrl: text('thumbnail_url'),
    /** Who saved it last (the member's name, or email when they have none), for "Last saved by". */
    updatedBy: text('updated_by'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    check('theme_role', sql`${t.role} in ('main','unpublished')`),
    uniqueIndex('theme_one_main_per_store').on(t.storeId).where(sql`role = 'main'`),
    index('theme_store').on(t.storeId),
  ],
)

/** Templates a theme renders, plus the two section groups every template shares. */
export const THEME_TEMPLATE_KINDS = [
  'home',
  'product',
  'collection',
  'page',
  'blog',
  'article',
  'cart',
  'search',
  'not_found',
  'header',
  'footer',
] as const
export type ThemeTemplateKind = (typeof THEME_TEMPLATE_KINDS)[number]

/**
 * One template of one theme, as Puck data (`content` is its ordered sections).
 * `suffix` names an alternate (`page.contact` is template `page`, suffix `contact`);
 * the empty string is the default. `draft` holds unsaved Customize edits: previews of
 * this theme render it, the storefront never does.
 */
export const themeTemplate = pgTable(
  'theme_template',
  {
    id: id(),
    storeId: storeId(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => theme.id, { onDelete: 'cascade' }),
    template: text('template').notNull(),
    suffix: text('suffix').notNull().default(''),
    sections: jsonb('sections').notNull(),
    draft: jsonb('draft'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'theme_template_kind',
      sql`${t.template} in ('home','product','collection','page','blog','article','cart','search','not_found','header','footer')`,
    ),
    check('theme_template_suffix', sql`${t.suffix} ~ '^[a-z0-9-]{0,40}$'`),
    uniqueIndex('theme_template_unique').on(t.themeId, t.template, t.suffix),
    index('theme_template_store').on(t.storeId),
  ],
)

/**
 * Version history of a theme's templates: a copy of a template's saved sections each time it
 * went live (the theme was published, or a live theme was saved). Rows taken together share
 * a `batch_id` (one publish or save). Restore copies a version into the template's draft; it
 * never goes live by itself. The newest 20 per template are kept.
 */
export const themeVersion = pgTable(
  'theme_version',
  {
    id: id(),
    storeId: storeId(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => theme.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').notNull(),
    /** What made it: `publish` (the theme went live) or `save` (a live theme was saved). */
    reason: text('reason').notNull(),
    template: text('template').notNull(),
    suffix: text('suffix').notNull().default(''),
    sections: jsonb('sections').notNull(),
    /** The member's name (or email) who published or saved. */
    createdBy: text('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    check('theme_version_reason', sql`${t.reason} in ('publish','save')`),
    index('theme_version_theme').on(t.themeId, t.template, t.suffix, t.createdAt),
    index('theme_version_batch').on(t.batchId),
    index('theme_version_store').on(t.storeId),
  ],
)

/**
 * The files of a theme imported from Shopify (`@commerce/core` theme-import): its Liquid
 * sections, snippets, blocks, layout, locales, config and assets, exactly as uploaded,
 * so the Liquid engine can render the theme's own markup and the storefront can serve its
 * CSS, JS and fonts. Text files are stored as UTF-8, binary assets as base64.
 */
export const themeFile = pgTable(
  'theme_file',
  {
    id: id(),
    storeId: storeId(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => theme.id, { onDelete: 'cascade' }),
    /** Path inside the theme, e.g. `sections/hero.liquid` or `assets/base.css`. */
    path: text('path').notNull(),
    body: text('body').notNull(),
    encoding: text('encoding').notNull().default('utf8'),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    /** SHA-256 of the bytes (hex, first 16); asset URLs carry it so caches never go stale. */
    checksum: text('checksum').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('theme_file_encoding', sql`${t.encoding} in ('utf8','base64')`),
    uniqueIndex('theme_file_path').on(t.themeId, t.path),
    index('theme_file_store').on(t.storeId),
  ],
)

/**
 * Saved versions of a theme file edited in Edit code: the body after each save, and the body
 * as imported (`import`), taken the first time the file is saved so the original is never lost.
 * Edit code compares any of them with the open file and restores one into the editor. The
 * newest 30 per file are kept.
 */
export const themeFileVersion = pgTable(
  'theme_file_version',
  {
    id: id(),
    storeId: storeId(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => theme.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    body: text('body').notNull(),
    /** `import` (the file as it came in), `create` (added in Edit code) or `save`. */
    reason: text('reason').notNull(),
    /** The member's name (or email) who saved; null for the import copy. */
    createdBy: text('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    check('theme_file_version_reason', sql`${t.reason} in ('import','create','save')`),
    index('theme_file_version_file').on(t.themeId, t.path, t.createdAt),
    index('theme_file_version_store').on(t.storeId),
  ],
)

/**
 * One row per imported theme: where it came from, the theme's own settings
 * (`config/settings_data.json`, current preset) and the import report the merchant reads.
 * A theme with a row here renders through the Liquid engine.
 */
export const themeImport = pgTable(
  'theme_import',
  {
    id: id(),
    storeId: storeId(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => theme.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('shopify'),
    fileName: text('file_name').notNull(),
    /** `theme_info` from settings_schema.json: name, version, author. */
    themeInfo: jsonb('theme_info').notNull().default({}),
    /** Theme settings (Shopify `settings`), images already re-hosted. */
    settings: jsonb('settings').notNull().default({}),
    report: jsonb('report').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('theme_import_source', sql`${t.source} in ('shopify')`),
    uniqueIndex('theme_import_theme').on(t.themeId),
    index('theme_import_store').on(t.storeId),
  ],
)
