import type { MetadataRoute } from 'next'

/** The admin is private: no search engine may crawl it. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
