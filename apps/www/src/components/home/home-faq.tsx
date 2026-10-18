import { homeContent } from '@/data/home'
import FaqList from '../common/faq-list'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'

const copy = homeContent.faq

export default function HomeFaq() {
  return (
    <section className="py-20 md:py-32">
      <PageContainer className="flex flex-col items-center gap-10 md:gap-14">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} />
        <FaqList
          items={copy.items}
          defaultOpen={0}
          className="max-w-[50rem] border-t border-border"
        />
      </PageContainer>
    </section>
  )
}
