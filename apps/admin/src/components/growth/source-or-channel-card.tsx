'use client'

import type { CampaignRow, ChannelRow, SourceRow } from '@commerce/api'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { growthOverviewContent as copy } from '@/data/growth'
import ChannelTableCard from './channel-table-card'
import SourceTableCard from './source-table-card'

type SourceOrChannelCardProps = {
  sources: SourceRow[]
  channels: ChannelRow[]
  campaigns: CampaignRow[]
}

type View = 'source' | 'channel'

/** Sales by source (plain names: Instagram, Google, WhatsApp...) or by channel, toggled. */
export default function SourceOrChannelCard({
  sources,
  channels,
  campaigns,
}: SourceOrChannelCardProps) {
  // Hooks
  const [view, setView] = useState<View>('source')

  // Event handlers
  const handleView = (next: string[]) => {
    const picked = next[0]
    if (picked === 'source' || picked === 'channel') setView(picked)
  }

  // Render logic
  const toggle = (
    <ToggleGroup value={[view]} onValueChange={handleView} className="mb-3 self-start">
      <ToggleGroupItem value="source">{copy.view.bySource}</ToggleGroupItem>
      <ToggleGroupItem value="channel">{copy.view.byChannel}</ToggleGroupItem>
    </ToggleGroup>
  )

  return (
    <div className="flex flex-col">
      {toggle}
      {view === 'source' ? (
        <SourceTableCard rows={sources} campaigns={campaigns} />
      ) : (
        <ChannelTableCard rows={channels} />
      )}
    </div>
  )
}
