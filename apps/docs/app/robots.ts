import { siteConfig } from '@commerce/config/site'
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteConfig.urls.docs}/sitemap.xml`,
  }
}
