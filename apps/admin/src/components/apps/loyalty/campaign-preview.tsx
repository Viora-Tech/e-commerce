'use client'

import { boostedPoints } from '@commerce/core/loyalty'
import type { CampaignDraft } from '@/components/apps/loyalty/campaign-editor'
import DataCard from '@/components/layout/data-card'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { multiplierBpFrom, multiplierLabel } from '@/lib/loyalty-campaigns'

type Tier = Awaited<ReturnType<typeof api.loyalty.tiers.list>>[number]

type CampaignPreviewProps = {
  draft: CampaignDraft
  tiers: Tier[]
}

/** The example order for the preview: one that earns 100 points without the campaign. */
const EXAMPLE_POINTS = 100

/** The campaign in one sentence, with what an example order earns, as the merchant fills it in. */
export default function CampaignPreview({ draft, tiers }: CampaignPreviewProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()

  // Render logic
  const k = copy.campaignForm
  const names = tiers.filter((t) => draft.tierIds.includes(t.id)).map((t) => t.name)
  const who =
    draft.who === 'all' || names.length === 0
      ? k.previewWhoAll
      : k.previewWhoTiers(names.join(', '))
  const from = draft.startsAt ? f.dateTime(draft.startsAt) : '…'
  const to = draft.endsAt ? f.dateTime(draft.endsAt) : '…'
  const bp = multiplierBpFrom(draft.multiplier)
  const pts = Number(draft.points)
  const multiplier = draft.bonusType === 'multiplier'
  const ok = multiplier ? bp !== null : Number.isInteger(pts) && pts > 0
  const boosted = multiplier
    ? boostedPoints(EXAMPLE_POINTS, bp ?? 10_000, 0)
    : boostedPoints(EXAMPLE_POINTS, 10_000, ok ? pts : 0)

  return (
    <DataCard title={k.previewTitle} bodyClassName="flex flex-col gap-2 text-body">
      {ok ? (
        <>
          <p>
            {multiplier
              ? k.previewMultiplier(multiplierLabel(bp ?? 10_000), from, to, who)
              : k.previewFixed(f.number(pts), from, to, who)}
          </p>
          <p className="text-muted-foreground">
            {k.previewExample(f.number(EXAMPLE_POINTS), f.number(boosted))}
          </p>
        </>
      ) : null}
      <p className="text-caption text-muted-foreground">{k.rule}</p>
    </DataCard>
  )
}
