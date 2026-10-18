import { pricingContent } from '@/data/pricing'
import FaqList from '../common/faq-list'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'

const copy = pricingContent.page.faq

export default function PricingFaq() {
  return (
    <PageContainer as="section" className="flex flex-col items-center gap-10 py-16 md:py-24">
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} size="subsection" />
      <div className="grid w-full gap-x-12 md:grid-cols-2">
        {copy.columns.map((column) => (
          <FaqList
            key={column[0]?.question}
            items={column}
            defaultOpen={column === copy.columns[0] ? 1 : undefined}
            className="border-t border-border"
          />
        ))}
      </div>
    </PageContainer>
  )
}
