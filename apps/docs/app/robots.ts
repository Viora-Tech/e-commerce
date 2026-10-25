import { siteConfig } from '@commerce/config/site'
import type { MetadataRoute } from 'next'

// Built once at `next build`: the site is a static export.
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteConfig.urls.docs}/sitemap.xml`,
  }
}
