import CtaBand from '@/components/common/cta-band'
import GlobeBackdrop from '@/components/common/globe-backdrop'
import PageContainer from '@/components/common/page-container'
import SiteShell from '@/components/layout/site-shell'
import AboutFirstStore from '@/components/pages/about-first-store'
import AboutFounder from '@/components/pages/about-founder'
import AboutMadeIn from '@/components/pages/about-made-in'
import AboutStory from '@/components/pages/about-story'
import AboutValues from '@/components/pages/about-values'
import { aboutContent as copy } from '@/data/about'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'About',
  description:
    'An AI-powered store, built in India, for anyone who sells. The story, the rules we build by and our first store.',
  path: '/about',
})

export default function AboutPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <PageContainer className="flex flex-col items-center gap-6 pt-20 text-center md:pt-28">
          <p className="text-eyebrow">{copy.eyebrow}</p>
          <h1 className="text-6xl font-semibold text-balance text-foreground md:text-8xl md:tracking-tighter">
            {copy.title[0]}
            <br />
            {copy.title[1]}
          </h1>
          <p className="max-w-2xl text-lead text-pretty text-muted-foreground">{copy.subtitle}</p>
        </PageContainer>
        <GlobeBackdrop className="mt-10" />
      </section>
      <AboutStory />
      <AboutFounder />
      <AboutValues />
      <AboutMadeIn />
      <AboutFirstStore />
      <CtaBand title={copy.cta.title} />
    </SiteShell>
  )
}
