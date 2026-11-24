'use client'

import type { EarnRuleRow, RewardRow } from '@commerce/core'
import type { LoyaltySettings } from '@commerce/core/loyalty'
import { useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import SaveBar from '@/components/layout/save-bar'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import {
  changedTiers,
  type ProgramDraft,
  programDraftOf,
  settingsChanged,
  spendChanged,
  tierInputOf,
} from '@/lib/loyalty-program'
import LoyaltyTab from './loyalty-tab'
import ProgramStatusAction from './program-status-action'
import ReferralsTab from './referrals-tab'

type Tab = 'loyalty' | 'referrals'

type Loaded = { draft: ProgramDraft; rules: EarnRuleRow[]; rewards: RewardRow[] }

async function loadProgram(): Promise<Loaded> {
  const [settings, rules, tiers, rewards] = await Promise.all([
    api.loyalty.settings.get(),
    api.loyalty.rules.list(),
    api.loyalty.tiers.list(),
    api.loyalty.rewards.list(),
  ])
  return { draft: programDraftOf(settings, rules, tiers), rules, rewards }
}

/**
 * The Loyalty points app's home: the program's status, the Loyalty part (VIP tiers, points per
 * spend, ways to earn, rewards, perks, settings) and the Referrals part. Settings, the spend
 * rule and tiers save together from the Save bar; rules and rewards save from their own editors.
 */
export default function LoyaltyProgramPage() {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const apps = useCopy(appsContent)
  const [tab, setTab] = useState<Tab>('loyalty')
  const [draft, setDraft] = useState<ProgramDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, failed, retry, setData } = useLoad(async () => {
    const loaded = await loadProgram()
    setDraft(loaded.draft)
    return loaded
  })

  // Helpers
  const setSettings = (patch: Partial<LoyaltySettings>) =>
    setDraft((d) => (d ? { ...d, settings: { ...d.settings, ...patch } } : d))
  const setSaved = (next: ProgramDraft) => setData((l) => (l ? { ...l, draft: next } : l))

  // Event handlers
  const handleSave = async () => {
    const saved = data?.draft
    if (!draft || !saved) return
    if (draft.tiers.some((t) => t.name.trim() === '')) {
      toast.error(copy.tiers.unnamed)
      return
    }
    setBusy(true)
    try {
      if (settingsChanged(draft.settings, saved.settings)) {
        await api.loyalty.settings.save(draft.settings)
      }
      if (spendChanged(draft.spend, saved.spend)) {
        await api.loyalty.rules.save({
          id: draft.spend.id,
          rule: {
            type: 'order_spend',
            key: '',
            title: null,
            points: draft.spend.points,
            settings: { excludeProductTags: draft.spend.excludeProductTags },
            enabled: draft.spend.enabled,
            position: 0,
          },
        })
      }
      for (const t of changedTiers(draft.tiers, saved.tiers)) {
        await api.loyalty.tiers.save({ id: t.id, tier: tierInputOf(t) })
      }
      toast.success(copy.saved)
      retry()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (data) setDraft(data.draft)
  }

  const handleStatus = (settings: LoyaltySettings) => {
    if (data) setSaved({ ...data.draft, settings })
    setSettings({ programStatus: settings.programStatus })
  }

  // Early returns
  if (!data && failed) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} summary={copy.subtitle} />
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.settings}
          failed={failed}
          onRetry={retry}
        />
      </div>
    )
  }
  if (!data || !draft) {
    return <SectionPageSkeleton cards={4} title={copy.title} subtitle={copy.subtitle} />
  }

  // Render logic
  const saved = data.draft
  const live = saved.settings.programStatus === 'live'
  const dirty =
    settingsChanged(draft.settings, saved.settings) ||
    spendChanged(draft.spend, saved.spend) ||
    changedTiers(draft.tiers, saved.tiers).length > 0 ||
    draft.tiers.length !== saved.tiers.length

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        badges={
          <StatusChip tone={live ? 'success' : 'attention'}>
            {live ? copy.status.live : copy.status.paused}
          </StatusChip>
        }
        actions={<ProgramStatusAction settings={saved.settings} onChanged={handleStatus} />}
      />
      {live ? null : (
        <p className="rounded-lg border border-line bg-muted px-4 py-3 text-body text-muted-foreground">
          {copy.status.pausedNote}
        </p>
      )}
      <PillTabs
        variant="segmented"
        label={copy.tabs.label}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'loyalty', label: copy.tabs.loyalty },
          { value: 'referrals', label: copy.tabs.referrals },
        ]}
      />
      {tab === 'loyalty' ? (
        <LoyaltyTab
          draft={draft}
          rules={data.rules}
          rewards={data.rewards}
          onDraft={setDraft}
          onRules={(rules) => setData((l) => (l ? { ...l, rules } : l))}
          onTierRemoved={(key) => {
            setSaved({ ...saved, tiers: saved.tiers.filter((t) => t.key !== key) })
            setDraft((d) => (d ? { ...d, tiers: d.tiers.filter((t) => t.key !== key) } : d))
          }}
        />
      ) : (
        <ReferralsTab
          referrals={draft.settings.referrals}
          onChange={(referrals) => setSettings({ referrals })}
        />
      )}
    </div>
  )
}
