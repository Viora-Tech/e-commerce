import CtaBand from '@/components/common/cta-band'
import Hero from '@/components/home/hero'
import HomeFaq from '@/components/home/home-faq'
import HomePricing from '@/components/home/home-pricing'
import IndiaBento from '@/components/home/india-bento'
import IntegrationsMarquee from '@/components/home/integrations-marquee'
import ProductTour from '@/components/home/product-tour'
import Proof from '@/components/home/proof'
import SellAnything from '@/components/home/sell-anything'
import ShopifyImport from '@/components/home/shopify-import'
import SiteShell from '@/components/layout/site-shell'
import { homeContent } from '@/data/home'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Run your store in plain words',
  description:
    'An AI-powered store built in India for anyone who sells: UPI-first checkout, GST invoices, Indian couriers, your Shopify theme and an admin in English and Hindi.',
  path: '/',
})

export default function HomePage() {
  return (
    <SiteShell>
      <Hero />
      <ProductTour />
      <SellAnything />
      <IndiaBento />
      <IntegrationsMarquee />
      <ShopifyImport />
      <Proof />
      <HomePricing />
      <HomeFaq />
      <CtaBand
        title={homeContent.cta.title}
        body={homeContent.cta.body}
        emailLabel={homeContent.cta.email}
      />
    </SiteShell>
  )
}
