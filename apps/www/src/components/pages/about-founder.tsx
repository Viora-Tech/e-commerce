import { UserRound } from '@commerce/ui/icons'
import { aboutContent as copy } from '@/data/about'
import PageContainer from '../common/page-container'

export default function AboutFounder() {
  return (
    <PageContainer as="section" className="py-10">
      <figure className="surface-glass grid gap-8 rounded-3xl p-6 md:grid-cols-[18rem_1fr] md:gap-12 md:p-10">
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong bg-muted/40 text-sm text-muted-foreground">
          <UserRound aria-hidden className="size-8" />
          {copy.founder.photo}
        </div>
        <div className="flex flex-col justify-center gap-5">
          <p className="text-eyebrow">{copy.founder.eyebrow}</p>
          <blockquote className="flex flex-col gap-4 text-lg text-pretty text-foreground md:text-xl">
            {copy.founder.quote.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </blockquote>
          <figcaption>
            <p className="text-3xl font-semibold text-foreground italic">{copy.founder.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.founder.role}</p>
          </figcaption>
        </div>
      </figure>
    </PageContainer>
  )
}
