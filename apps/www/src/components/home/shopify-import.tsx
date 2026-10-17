import {
  ArrowDown_ as ArrowDown,
  ArrowRight_ as ArrowRight,
  Upload_ as Upload,
} from '@commerce/ui/icons'
import { homeContent } from '@/data/home'
import AmbientLight from '../common/ambient-light'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'
import ShopifyMock from './shopify-mock'

const copy = homeContent.shopify

export default function ShopifyImport() {
  return (
    <section className="relative isolate overflow-hidden py-20 md:py-32">
      <AmbientLight className="top-1/2 left-1/2 h-72 w-[56rem] max-w-full -translate-x-1/2" />
      <PageContainer className="flex flex-col items-center gap-12 md:gap-16">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />
        <div className="grid w-full max-w-[68rem] items-center gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-8">
          <ShopifyMock variant="before" />
          <div className="flex flex-col items-center gap-3">
            <span className="glass-popover inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs text-foreground">
              <Upload aria-hidden className="size-3.5" />
              {copy.zip}
            </span>
            <ArrowRight aria-hidden className="hidden size-5 text-muted-foreground md:block" />
            <ArrowDown aria-hidden className="size-5 text-muted-foreground md:hidden" />
          </div>
          <ShopifyMock variant="after" />
        </div>
      </PageContainer>
    </section>
  )
}
