'use client'

import { useRouter } from 'next/navigation'
import PillTabs from '@/components/layout/pill-tabs'
import { growthCampaignTabsContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type CampaignsTabsProps = { value: 'campaigns' | 'links' }

/** Campaigns | Tracking links: the two halves of Growth → Campaigns. */
export default function CampaignsTabs({ value }: CampaignsTabsProps) {
  // Hooks
  const copy = useCopy(growthCampaignTabsContent.tabs)
  const router = useRouter()

  // Event handlers
  const handleChange = (next: 'campaigns' | 'links') => {
    router.push(next === 'links' ? routes.growth.trackingLinks() : routes.growth.campaigns())
  }

  // Render logic
  return (
    <PillTabs
      variant="underline"
      tabs={[
        { value: 'campaigns' as const, label: copy.campaigns },
        { value: 'links' as const, label: copy.links },
      ]}
      value={value}
      onChange={handleChange}
    />
  )
}
