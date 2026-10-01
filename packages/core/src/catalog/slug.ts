/**
 * SOURCE OF TRUTH KEYWORDS: slugify, handle, URL slug
 * WHAT:  Title → URL handle for products, collections, pages, menus, blogs, metaobjects.
 * WHY:   One rule for every handle so admin placeholders match what the server saves.
 * WHERE: Core services; admin dialogs via `@commerce/core/catalog` (client-safe).
 */
/** "Talongames 幻 Maboroshi" → "talongames-maboroshi". ASCII only so the URL is typeable. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}
