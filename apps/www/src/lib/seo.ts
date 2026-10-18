/**
 * SOURCE OF TRUTH: structured data — WHAT the schema.org JSON-LD the landing site puts on its
 * pages (the company, the site, the product with its plans, FAQs, breadcrumbs, articles) / WHY
 * search engines read these for rich results, and each must say only what the page shows.
 */
import { siteConfig } from '@commerce/config/site'

const site = siteConfig.urls.site
const brand = siteConfig.brand.name

export type JsonLd = Record<string, unknown>

const absolute = (path: string) => (path.startsWith('http') ? path : `${site}${path}`)

export function organizationLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site}/#organization`,
    name: brand,
    url: site,
    logo: absolute('/icon-192.png'),
    email: siteConfig.contact.supportEmail,
    areaServed: 'IN',
  }
}

export function websiteLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    name: brand,
    url: site,
    inLanguage: 'en-IN',
    publisher: { '@id': `${site}/#organization` },
  }
}

/** The product with every plan as an offer, prices before GST (the pricing page shows the same). */
export function softwareLd(): JsonLd {
  const plans = Object.values(siteConfig.plans)
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: brand,
    url: site,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'E-commerce platform',
    operatingSystem: 'Web',
    description:
      'AI-powered e-commerce platform for Indian brands: UPI-first checkout, GST invoices, Indian couriers, Shopify theme import and an admin in English and Hindi.',
    publisher: { '@id': `${site}/#organization` },
    offers: plans.map((plan) => ({
      '@type': 'Offer',
      name: `${plan.name} (monthly)`,
      price: plan.monthlyInr,
      priceCurrency: 'INR',
      url: absolute('/pricing'),
      category: 'subscription',
    })),
  }
}

export function faqLd(items: readonly { question: string; answer: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/** Home first, then each step; the last is the page itself. */
export function breadcrumbLd(trail: readonly { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: brand, path: '/' }, ...trail].map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: absolute(step.path),
    })),
  }
}

export function articleLd(article: {
  title: string
  description: string
  path: string
  published: string
  updated: string
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url: absolute(article.path),
    mainEntityOfPage: absolute(article.path),
    datePublished: article.published,
    dateModified: article.updated,
    inLanguage: 'en-IN',
    author: { '@id': `${site}/#organization` },
    publisher: { '@id': `${site}/#organization` },
    image: absolute(`${article.path}/opengraph-image`),
  }
}
