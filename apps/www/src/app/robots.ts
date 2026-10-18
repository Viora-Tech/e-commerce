import { siteConfig } from '@commerce/config/site'
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/waitlist/' },
    sitemap: `${siteConfig.urls.site}/sitemap.xml`,
  }
}
