/** SOURCE OF TRUTH: where a file is used — WHAT: the count the Files library shows per file and the file page's "Used in" list, across products (galleries and variant images), collections, blog posts, pages, reviews and themes (settings, templates and an imported theme's JSON) / WHY: a file used only by a collection, a review or the theme was shown as "Not used" (#90) */
import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'

export type MediaReferenceKind = 'product' | 'collection' | 'article' | 'page' | 'review' | 'theme'

/** One thing using a file, for the file page: `id` is what its admin page is keyed by. */
export type MediaReference = { kind: MediaReferenceKind; id: string; title: string }

/*
 * Every web address in the store's themes: their settings, their templates and the JSON files of
 * an imported (Liquid) theme. Themes keep a picked image as its address, not the file's id, so a
 * file is used by a theme when its address is in this set. Uncorrelated, so Postgres builds the
 * set once per query and hashes it, rather than scanning theme JSON for every file.
 */
const themeUrls = sql.raw(`(
  select (regexp_matches(src.v, 'https?://[^"''<>)\\\\[:space:]]+', 'g'))[1]
  from (
    select t.settings::text as v from theme t
    union all select tt.sections::text from theme_template tt
    union all select tf.body from theme_file tf where tf.encoding = 'utf8' and tf.path like '%.json'
  ) src
)`)

/* Correlated on the outer `media` row; Drizzle leaves single-table columns unqualified, so spell them out. */
const productUses = `(select count(*)::int from (
  select pm.product_id from product_media pm where pm.media_id = media.id
  union select v.product_id from variant v where v.media_id = media.id
  union select v.product_id from variant_media vm join variant v on v.id = vm.variant_id where vm.media_id = media.id
) p)`
const collectionUses = `(select count(*)::int from collection c where c.image_media_id = media.id)`
const articleUses = `(select count(*)::int from article a
  where a.image_media_id = media.id or position(media.url in coalesce(a.body::text, '')) > 0)`
const pageUses = `(select count(*)::int from page pg where position(media.url in coalesce(pg.body::text, '')) > 0)`
const reviewUses = `(select count(distinct rm.review_id)::int from review_media rm where rm.media_id = media.id)`

/** How many products, collections, blog posts, pages and reviews use the file, plus 1 when a theme does. */
export const mediaUseCount = sql<number>`(${sql.raw(
  [productUses, collectionUses, articleUses, pageUses, reviewUses].join(' + '),
)} + (case when media.url in ${themeUrls} then 1 else 0 end))`

/** Everything using one file, grouped by kind and then by title: the file page's "Used in". */
export async function mediaReferences(tx: StoreTx, id: string): Promise<MediaReference[]> {
  const rows = await tx.execute<MediaReference>(sql`
    with f as (select m.id, m.url from media m where m.id = ${id}::uuid)
    select 'product' as kind, p.id::text as id, p.title from product p, f
      where p.id in (
        select pm.product_id from product_media pm where pm.media_id = f.id
        union select v.product_id from variant v where v.media_id = f.id
        union select v.product_id from variant_media vm join variant v on v.id = vm.variant_id where vm.media_id = f.id
      )
    union all
    select 'collection', c.id::text, c.title from collection c, f where c.image_media_id = f.id
    union all
    select 'article', a.id::text, a.title from article a, f
      where a.image_media_id = f.id or position(f.url in coalesce(a.body::text, '')) > 0
    union all
    select 'page', pg.id::text, pg.title from page pg, f
      where position(f.url in coalesce(pg.body::text, '')) > 0
    union all
    select distinct 'review', r.id::text, coalesce(nullif(r.title, ''), r.reviewer_name) from review r
      join review_media rm on rm.review_id = r.id, f
      where rm.media_id = f.id
    union all
    select 'theme', t.id::text, t.name from theme t, f
      where position(f.url in t.settings::text) > 0
        or exists (select 1 from theme_template tt where tt.theme_id = t.id and position(f.url in tt.sections::text) > 0)
        or exists (select 1 from theme_file tf where tf.theme_id = t.id and tf.encoding = 'utf8'
          and tf.path like '%.json' and position(f.url in tf.body) > 0)
    order by 1, 3, 2
  `)
  return [...rows]
}
