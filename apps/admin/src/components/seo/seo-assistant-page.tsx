'use client'

import type { SeoAssistantView } from '@commerce/core/seo-assistant-service'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { seoAssistantContent } from '@/data/seo-assistant'
import { useCopy } from '@/hooks/use-copy'
import SeoAssistantEmpty from './seo-assistant-empty'
import SeoFixDialog, { type SeoFixTarget } from './seo-fix-dialog'
import SeoOpportunityList from './seo-opportunity-list'
import SeoTabs from './seo-tabs'

type SeoAssistantPageProps = {
  view: SeoAssistantView
  /** Write with AI is on for the store and allowed for this member. */
  aiOn: boolean
}

/**
 * Online store › SEO › Search opportunities: every product, collection and page Google showed,
 * biggest chance first, with "Fix with AI" for one or a selection. Nothing is saved until the
 * merchant applies the drafts in the dialog.
 */
export default function SeoAssistantPage({ view, aiOn }: SeoAssistantPageProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(seoAssistantContent)
  const [targets, setTargets] = useState<SeoFixTarget[]>([])

  // Event handlers
  const handleClose = () => setTargets([])
  const handleApplied = () => {
    setTargets([])
    router.refresh()
  }

  return (
    <PageBody>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <SeoTabs value="assistant" />
      {view.state === 'ready' ? (
        <SeoOpportunityList
          rows={view.rows}
          syncedAt={view.syncedAt}
          aiOn={aiOn}
          onFix={setTargets}
        />
      ) : (
        <SeoAssistantEmpty state={view.state} />
      )}
      {targets.length > 0 ? (
        <SeoFixDialog targets={targets} onClose={handleClose} onApplied={handleApplied} />
      ) : null}
    </PageBody>
  )
}
