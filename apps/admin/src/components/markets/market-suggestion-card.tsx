'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type MarketSuggestionCardProps = {
  /** The saved setting (`store.preferences.markets.suggestMarket`). */
  suggestMarket: boolean
  canManage: boolean
}

/**
 * Settings for every market, under the Markets list: whether the online store offers a visitor
 * the market of their country ("Shopping from the UAE? Shop in AED"). The switch saves at once.
 */
export default function MarketSuggestionCard({
  suggestMarket,
  canManage,
}: MarketSuggestionCardProps) {
  // Hooks
  const { suggestion: copy } = useCopy(marketsContent)
  const [on, setOn] = useState(suggestMarket)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleChange = async (next: boolean) => {
    setOn(next)
    setSaving(true)
    try {
      await api.markets.saveSettings({ suggestMarket: next })
      toast.success(next ? copy.on : copy.off)
    } catch (err) {
      setOn(!next)
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard title={copy.heading} description={copy.body}>
      <SettingsToggleRow
        id="markets-suggest"
        label={copy.label}
        description={copy.help}
        checked={on}
        onChange={handleChange}
        disabled={!canManage || saving}
      />
    </SettingsCard>
  )
}
