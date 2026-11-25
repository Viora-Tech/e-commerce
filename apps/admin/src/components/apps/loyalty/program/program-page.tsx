'use client'

import type { EarnRuleRow, RewardRow } from '@commerce/core'
import type { LoyaltySettings } from '@commerce/core/loyalty'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import ActionMenu from '@/components/layout/action-menu'
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
import { routes } from '@/lib/routes'
import SetupBar, { setupStepOf } from '../setup-bar'
import LoyaltyTab from './loyalty-tab'
import ProgramStatusAction from './program-status-action'
import ReferralsTab from './referrals-tab'
import RewardsRate from './rewards-rate'

type Tab = 'loyalty' | 'referrals'

type Loaded = {
  draft: ProgramDraft
  rules: EarnRuleRow[]
  rewards: RewardRow[]
  /** Customize for the live theme; null when the store has none. */
  editor: string | null
  /** The loyalty widget app embed is on in the live theme. */
  placementsOn: boolean
  storeName: string
}

async function loadProgram(): Promise<Loaded> {
  const [settings, rules, tiers, rewards, themes, store] = await Promise.all([
    api.loyalty.settings.get(),
    api.loyalty.rules.list(),
    api.loyalty.tiers.list(),
    api.loyalty.rewards.list(),
    api.themes.list().catch(() => []),
    api.store.current().catch(() => null),
  ])
  const live = themes.find((t) => t.role === 'main') ?? null
  return {
    draft: programDraftOf(settings, rules, tiers),
    rules,
    rewards,
    editor: live ? routes.onlineStore.themeEditor(live.id) : null,
    placementsOn: Boolean(live?.settings.appEmbeds?.['loyalty/Widget']?.enabled),
    storeName: store?.name ?? '',
  }
}

/** Rewards given back as a percent of spend: points per ₹100, each point ₹1. */
const ratePercentOf = (d: ProgramDraft) => (d.spend.enabled ? d.spend.points : 0)

/**
 * The Loyalty points app's Program page, laid out like Essential Loyalty's: the Loyalty |
 * Referrals switch and the rewards rate, the setup bar, then the tab. Settings, the spend rule
 * and tiers save together from the Save bar; rules and rewards save from their own editors.
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
  const referrals = draft.settings.referrals
  const ratePercent = ratePercentOf(draft)
  const setup = { live, placementsOn: data.placementsOn, ratePercent }
  const step = setupStepOf(setup)
  const embedHref = data.editor ? `${data.editor}?panel=apps` : null
  const dirty =
    settingsChanged(draft.settings, saved.settings) ||
    spendChanged(draft.spend, saved.spend) ||
    changedTiers(draft.tiers, saved.tiers).length > 0 ||
    draft.tiers.length !== saved.tiers.length
  const setupAction =
    step === 'activate' ? (
      <ProgramStatusAction
        settings={saved.settings}
        onChanged={handleStatus}
        goLiveLabel={copy.setup.current.activate.title}
      />
    ) : step === 'placements' && embedHref ? (
      <Button nativeButton={false} render={<Link href={embedHref} />}>
        {copy.setup.embedButton}
      </Button>
    ) : null

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
        badges={
          <StatusChip tone={live ? 'success' : 'attention'}>
            {live ? copy.status.live : copy.status.paused}
          </StatusChip>
        }
        actions={
          <>
            <ActionMenu
              label={copy.menu.label}
              variant="outline"
              size="md"
              items={[
                { label: copy.menu.members, href: routes.apps.page('loyalty', 'members') },
                { label: copy.menu.placements, href: routes.apps.page('loyalty', 'placements') },
                { label: copy.menu.emails, href: routes.apps.page('loyalty', 'emails') },
                {
                  label: copy.menu.referralsOff,
                  hidden: !referrals.enabled,
                  separatorBefore: true,
                  onSelect: () => setSettings({ referrals: { ...referrals, enabled: false } }),
                },
              ]}
            />
            <ProgramStatusAction settings={saved.settings} onChanged={handleStatus} />
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
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
          {tab === 'referrals' && !referrals.enabled ? (
            <StatusChip tone="neutral">{copy.referrals.disabled}</StatusChip>
          ) : null}
        </div>
        <RewardsRate percent={ratePercent} />
      </div>
      <SetupBar {...setup} action={setupAction} />
      {tab === 'loyalty' ? (
        <LoyaltyTab
          draft={draft}
          rules={data.rules}
          rewards={data.rewards}
          storeName={data.storeName}
          onDraft={setDraft}
          onRules={(rules) => setData((l) => (l ? { ...l, rules } : l))}
          onTierRemoved={(key) => {
            setSaved({ ...saved, tiers: saved.tiers.filter((t) => t.key !== key) })
            setDraft((d) => (d ? { ...d, tiers: d.tiers.filter((t) => t.key !== key) } : d))
          }}
        />
      ) : (
        <ReferralsTab
          referrals={referrals}
          popupHref={embedHref}
          onChange={(next) => setSettings({ referrals: next })}
        />
      )}
    </div>
  )
}
