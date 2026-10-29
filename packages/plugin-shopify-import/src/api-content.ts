/** Pages, blog articles, menus and redirects from the Admin GraphQL API. */

import { PAGE_INFO, type Page, templateSuffix } from './shopify-api'
import type { ShopifyClient } from './shopify-client'
import type { NArticle, NMenu, NMenuItem, NPage, NRedirect } from './types'

const PAGES_QUERY = `query Pages($cursor: String, $query: String) {
  pages(first: 50, after: $cursor, query: $query) {
    ${PAGE_INFO}
    nodes {
      id handle title body isPublished publishedAt templateSuffix
      seoTitle: metafield(namespace: "global", key: "title_tag") { value }
      seoDescription: metafield(namespace: "global", key: "description_tag") { value }
    }
  }
}`

type GPage = {
  id: string
  handle: string
  title: string
  body: string | null
  isPublished: boolean
  publishedAt: string | null
  templateSuffix: string | null
  seoTitle: { value: string } | null
  seoDescription: { value: string } | null
}

export async function* fetchPages(
  client: ShopifyClient,
  search: string | null = null,
): AsyncGenerator<NPage[]> {
  for await (const nodes of client.paginate<GPage>(
    PAGES_QUERY,
    (d) => (d as { pages: Page<GPage> }).pages,
    { query: search },
    150,
  )) {
    yield nodes.map((p) => ({
      sourceId: p.id,
      handle: p.handle,
      title: p.title,
      bodyHtml: p.body || null,
      seoTitle: p.seoTitle?.value || null,
      seoDescription: p.seoDescription?.value || null,
      published: p.isPublished,
      publishedAt: p.publishedAt,
      templateSuffix: templateSuffix(p.templateSuffix),
    }))
  }
}

const ARTICLES_QUERY = `query Articles($cursor: String, $query: String) {
  articles(first: 50, after: $cursor, query: $query) {
    ${PAGE_INFO}
    nodes {
      id handle title body summary tags isPublished publishedAt templateSuffix
      author { name }
      image { url altText }
      blog { handle title templateSuffix }
      seoTitle: metafield(namespace: "global", key: "title_tag") { value }
      seoDescription: metafield(namespace: "global", key: "description_tag") { value }
    }
  }
}`

type GArticle = {
  id: string
  handle: string
  title: string
  body: string | null
  summary: string | null
  tags: string[]
  isPublished: boolean
  publishedAt: string | null
  author: { name: string } | null
  image: { url: string; altText: string | null } | null
  templateSuffix: string | null
  blog: { handle: string; title: string; templateSuffix: string | null }
  seoTitle: { value: string } | null
  seoDescription: { value: string } | null
}

export async function* fetchArticles(
  client: ShopifyClient,
  search: string | null = null,
): AsyncGenerator<NArticle[]> {
  for await (const nodes of client.paginate<GArticle>(
    ARTICLES_QUERY,
    (d) => (d as { articles: Page<GArticle> }).articles,
    { query: search },
    200,
  )) {
    yield nodes.map((a) => ({
      sourceId: a.id,
      blogHandle: a.blog.handle,
      blogTitle: a.blog.title,
      handle: a.handle,
      title: a.title,
      author: a.author?.name ?? null,
      bodyHtml: a.body || null,
      summaryHtml: a.summary || null,
      tags: a.tags,
      image: a.image ? { src: a.image.url, alt: a.image.altText, position: 1 } : null,
      published: a.isPublished,
      publishedAt: a.publishedAt,
      seoTitle: a.seoTitle?.value || null,
      seoDescription: a.seoDescription?.value || null,
      templateSuffix: templateSuffix(a.templateSuffix),
      blogTemplateSuffix: templateSuffix(a.blog.templateSuffix),
    }))
  }
}

/* ------------------------------------------------------ menus, redirects */

const ITEM = 'title type url'
const MENUS_QUERY = `query Menus($cursor: String) {
  menus(first: 25, after: $cursor) {
    ${PAGE_INFO}
    nodes { id handle title items { ${ITEM} items { ${ITEM} items { ${ITEM} } } } }
  }
}`

type GMenuItem = { title: string; type: string; url: string | null; items?: GMenuItem[] }
type GMenu = { id: string; handle: string; title: string; items: GMenuItem[] }

const mapItem = (i: GMenuItem): NMenuItem => ({
  title: i.title,
  type: i.type,
  url: i.url,
  items: (i.items ?? []).map(mapItem),
})

export async function* fetchMenus(client: ShopifyClient): AsyncGenerator<NMenu[]> {
  for await (const nodes of client.paginate<GMenu>(
    MENUS_QUERY,
    (d) => (d as { menus: Page<GMenu> }).menus,
    {},
    100,
  )) {
    yield nodes.map((m) => ({
      sourceId: m.id,
      handle: m.handle,
      title: m.title,
      items: m.items.map(mapItem),
    }))
  }
}

const REDIRECTS_QUERY = `query Redirects($cursor: String) {
  urlRedirects(first: 250, after: $cursor) { ${PAGE_INFO} nodes { id path target } }
}`

export async function* fetchRedirects(client: ShopifyClient): AsyncGenerator<NRedirect[]> {
  for await (const nodes of client.paginate<{ id: string; path: string; target: string }>(
    REDIRECTS_QUERY,
    (d) => (d as { urlRedirects: Page<{ id: string; path: string; target: string }> }).urlRedirects,
    {},
    260,
  )) {
    yield nodes.map((r) => ({ sourceId: r.id, path: r.path, target: r.target }))
  }
}
