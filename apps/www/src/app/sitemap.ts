import { siteConfig } from '@commerce/config/site'
import type { MetadataRoute } from 'next'
import { STORE_APPS } from '@/data/apps'
import { GUIDES } from '@/data/guides'
import { SOLUTIONS } from '@/data/solutions'

/** When the static pages last changed meaningfully; move it when their content does. */
const PAGES_UPDATED = '2026-10-19'

const PAGES = [
  { path: '/', priority: 1 },
  { path: '/features', priority: 0.9 },
  { path: '/pricing', priority: 0.9 },
  { path: '/solutions', priority: 0.8 },
  { path: '/apps', priority: 0.8 },
  { path: '/guides', priority: 0.7 },
  { path: '/changelog', priority: 0.7 },
  { path: '/about', priority: 0.6 },
  { path: '/contact', priority: 0.6 },
  { path: '/security', priority: 0.6 },
  { path: '/privacy', priority: 0.3 },
  { path: '/terms', priority: 0.3 },
  { path: '/cookies', priority: 0.3 },
  { path: '/refunds', priority: 0.3 },
  { path: '/shipping', priority: 0.3 },
  { path: '/acceptable-use', priority: 0.3 },
]

// Built once at `next build`: the site is a static export.
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${siteConfig.urls.site}${path === '/' ? '' : path}`
  return [
    ...PAGES.map((page) => ({
      url: url(page.path),
      lastModified: PAGES_UPDATED,
      priority: page.priority,
    })),
    ...SOLUTIONS.map((s) => ({
      url: url(`/solutions/${s.slug}`),
      lastModified: PAGES_UPDATED,
      priority: 0.8,
    })),
    ...GUIDES.map((g) => ({
      url: url(`/guides/${g.slug}`),
      lastModified: g.updated,
      priority: 0.6,
    })),
    ...STORE_APPS.map((app) => ({
      url: url(`/apps/${app.id}`),
      lastModified: PAGES_UPDATED,
      priority: 0.5,
    })),
  ]
}
