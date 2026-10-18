import CtaBand from '@/components/common/cta-band'
import JsonLd from '@/components/common/json-ld'
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
import { faqLd, softwareLd } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Koomerce: AI e-commerce platform for Indian brands',
  description:
    'Run your online store in plain words. UPI-first checkout, GST invoices, Delhivery, Shiprocket and RapidShyp, Shopify theme import and an admin in English and Hindi. 0% transaction fee.',
  path: '/',
})

export default function HomePage() {
  return (
    <SiteShell>
      <JsonLd data={[softwareLd(), faqLd(homeContent.faq.items)]} />
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
