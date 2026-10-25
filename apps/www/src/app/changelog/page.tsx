import PageContainer from '@/components/common/page-container'
import SectionHeading from '@/components/common/section-heading'
import SiteShell from '@/components/layout/site-shell'
import ChangelogSubscribe from '@/components/pages/changelog-subscribe'
import ChangelogTimeline from '@/components/pages/changelog-timeline'
import { changelogContent as copy } from '@/data/changelog'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Changelog',
  description: 'Every change to the platform, newest first, in plain words.',
  path: '/changelog',
})

export default function ChangelogPage() {
  return (
    <SiteShell>
      <PageContainer as="section" className="flex flex-col items-center gap-8 pt-20 pb-12 md:pt-28">
        <SectionHeading
          as="h1"
          size="display"
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
        />
        <ChangelogSubscribe />
      </PageContainer>
      <ChangelogTimeline />
    </SiteShell>
  )
}
