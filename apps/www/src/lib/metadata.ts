import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'

type PageMeta = { title: string; description: string; path: string }

/** Per-page metadata: title, description, canonical URL and the Open Graph / Twitter card. */
export function pageMetadata({ title, description, path }: PageMeta): Metadata {
  const fullTitle = path === '/' ? title : `${title} · ${siteConfig.brand.name}`
  return {
    title: path === '/' ? { absolute: fullTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: siteConfig.brand.name,
      type: 'website',
      locale: 'en_IN',
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description },
  }
}
