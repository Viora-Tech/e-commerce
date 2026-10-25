import { siteConfig } from '@commerce/config/site'
import type { MetadataRoute } from 'next'
import { getPageMap } from 'nextra/page-map'

type PageMapItem = { route?: string; children?: PageMapItem[]; frontMatter?: unknown }

/** Every docs page Nextra knows, from its page map (folders and their pages). */
function routesOf(items: PageMapItem[], into: Set<string>): Set<string> {
  for (const item of items) {
    if (item.route && 'frontMatter' in item) into.add(item.route)
    if (item.children) routesOf(item.children, into)
  }
  return into
}

// Built once at `next build`: the site is a static export.
export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = routesOf((await getPageMap()) as PageMapItem[], new Set(['/']))
  return [...routes].sort().map((route) => ({
    url: `${siteConfig.urls.docs}${route === '/' ? '' : route}`,
  }))
}
