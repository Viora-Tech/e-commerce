'use client'

import PillTabs from '@/components/layout/pill-tabs'
import { seoAssistantContent } from '@/data/seo-assistant'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type SeoTabsProps = {
  value: 'report' | 'assistant'
}

/** Online store › SEO's two tabs: the report and Search opportunities, each its own page. */
export default function SeoTabs({ value }: SeoTabsProps) {
  // Hooks
  const copy = useCopy(seoAssistantContent.tabs)

  return (
    <PillTabs
      variant="underline"
      label={copy.assistant}
      value={value}
      tabs={[
        { value: 'report', label: copy.report, href: routes.onlineStore.seo() },
        { value: 'assistant', label: copy.assistant, href: routes.onlineStore.seoAssistant() },
      ]}
    />
  )
}
