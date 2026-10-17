import { siteConfig } from '@commerce/config/site'
import type { MetadataRoute } from 'next'

const PAGES = [
  { path: '/', priority: 1 },
  { path: '/features', priority: 0.9 },
  { path: '/pricing', priority: 0.9 },
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

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: `${siteConfig.urls.site}${page.path === '/' ? '' : page.path}`,
    priority: page.priority,
  }))
}
