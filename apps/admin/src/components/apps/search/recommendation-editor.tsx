'use client'

import { RECOMMENDATION_INTENTS, type RecommendationIntentKind } from '@commerce/core/discovery'
import { SEARCH_ID } from '@commerce/plugin-search'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import PageHeader from '@/components/layout/page-header'
import InlineState from '@/components/states/inline-state'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import RecommendationRowCard from './recommendation-row-card'

type Loaded = Awaited<ReturnType<typeof api.search.recommendations.get>>

/**
 * One product's hand-picked recommendations (`recommendations/[productId]`): the "You may also
 * like" and "Pairs well with" rows, each ordered and saved on its own. A full page.
 */
export default function RecommendationEditor({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const productId = params.productId ?? ''
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined)

  useEffect(() => {
    api.search.recommendations
      .get({ productId })
      .then(setLoaded)
      .catch(() => setLoaded(null))
  }, [productId])

  // Event handlers
  const handleSave = async (intent: RecommendationIntentKind, ids: string[]) => {
    try {
      const picks = await api.search.recommendations.set({ productId, intent, productIds: ids })
      setLoaded((prev) => (prev ? { ...prev, picks } : prev))
      toast.success(copy.editor.saved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    }
  }

  // Early returns
  if (loaded === undefined) return null
  const back = { label: copy.editor.back, href: routes.apps.page(SEARCH_ID, 'recommendations') }
  if (loaded === null) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={copy.recommendations.title} back={back} />
        <InlineState kind="empty" body={copy.editor.notFound} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.editor.title(loaded.product.title)}
        summary={copy.editor.summary}
        back={back}
      />
      {RECOMMENDATION_INTENTS.map((intent) => (
        <RecommendationRowCard
          key={intent}
          title={copy.editor.rows[intent].title}
          description={copy.editor.rows[intent].description}
          productId={productId}
          picks={loaded.picks[intent]}
          onSave={(ids) => handleSave(intent, ids)}
        />
      ))}
    </div>
  )
}
