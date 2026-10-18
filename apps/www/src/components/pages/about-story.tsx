import { aboutContent as copy } from '@/data/about'
import PageContainer from '../common/page-container'
import SectionHeading from '../common/section-heading'

export default function AboutStory() {
  return (
    <PageContainer as="section" className="grid gap-12 py-20 md:py-28 lg:grid-cols-[1fr_1.1fr]">
      <SectionHeading
        eyebrow={copy.story.eyebrow}
        title={copy.story.title}
        subtitle={copy.story.note}
        align="left"
        className="lg:sticky lg:top-28 lg:self-start"
      />
      <ol className="flex flex-col">
        {copy.story.items.map((item) => (
          <li key={item.title} className="relative flex gap-5 pb-10 last:pb-0">
            <span
              aria-hidden
              className="absolute top-3 bottom-0 left-[0.3rem] w-px bg-border last:hidden"
            />
            <span
              aria-hidden
              className="relative mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-foreground bg-background"
            />
            <div className="flex flex-col gap-1.5">
              <p className="text-eyebrow">{item.when}</p>
              <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
              <p className="text-base text-muted-foreground">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </PageContainer>
  )
}
