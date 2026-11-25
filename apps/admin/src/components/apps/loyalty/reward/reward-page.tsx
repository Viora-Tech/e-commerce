'use client'

import type { RewardRow, TierRow } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import { appsContent } from '@/data/apps'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import {
  newRewardForm,
  type RewardForm,
  rewardFormOf,
  rewardInputOf,
  rewardProblem,
} from '@/lib/loyalty-reward-form'
import { routes } from '@/lib/routes'
import RewardDetailsCard from './reward-details-card'
import RewardLimitsCard from './reward-limits-card'
import RewardRulesCard from './reward-rules-card'
import RewardSummary from './reward-summary'
import RewardTypeCard from './reward-type-card'

type Loaded = { reward: RewardRow | null; tiers: TierRow[]; form: RewardForm }

/**
 * New reward (`rewards/new`) or one to change (`rewards/<id>`), laid out like Essential
 * Loyalty's reward page: type and customer title, the reward's value, eligibility,
 * requirements, usage limit and the discount code on the left; the shopper preview and a
 * summary on the right. Disable / Delete / Save sit in the header.
 */
export default function LoyaltyRewardPage({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)
  const apps = useCopy(appsContent)
  const fmt = useFormat()
  const router = useRouter()
  const [form, setForm] = useState<RewardForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const { data, failed, retry, setData } = useLoad<Loaded>(async () => {
    const id = params.id ?? 'new'
    const [rewards, tiers] = await Promise.all([
      api.loyalty.rewards.list(),
      api.loyalty.tiers.list(),
    ])
    const reward = id === 'new' ? null : (rewards.find((r) => r.id === id) ?? null)
    if (id !== 'new' && !reward) throw new Error(copy.notFound)
    let productTitle = ''
    if (reward?.productId) {
      productTitle =
        (await api.products.get({ id: reward.productId }).catch(() => null))?.title ?? ''
    }
    const next = reward
      ? rewardFormOf(reward, productTitle, fmt.money)
      : newRewardForm('amount_off', copy.defaultTitles, rewards.length)
    setForm(next)
    return { reward, tiers, form: next }
  }, [params.id])

  // Helpers
  const set = (patch: Partial<RewardForm>) => setForm((f) => (f ? { ...f, ...patch } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    const problem = rewardProblem(form)
    if (problem) {
      toast.error(copy.problems[problem])
      return
    }
    setBusy(true)
    try {
      const saved = await api.loyalty.rewards.save({
        id: data?.reward?.id ?? null,
        reward: rewardInputOf(form, fmt.money),
      })
      toast.success(copy.saved)
      if (!data?.reward) {
        router.replace(routes.apps.page('loyalty', 'rewards', saved.id))
        return
      }
      const next = rewardFormOf(saved, form.productTitle, fmt.money)
      setForm(next)
      setData((d) => (d ? { ...d, reward: saved, form: next } : d))
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!data?.reward) return
    const { result } = await api.loyalty.rewards.remove({ id: data.reward.id })
    toast.success(result === 'deleted' ? copy.removed : copy.deactivated)
    router.push(routes.apps.page('loyalty'))
  }

  // Early returns
  const back = { label: copy.back, href: routes.apps.page('loyalty') }
  if (!data && failed) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={copy.newTitle} back={back} />
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.page}
          failed={failed}
          onRetry={retry}
        />
      </div>
    )
  }
  if (!data || !form) return <DetailPageSkeleton />

  // Render logic
  const dirty = JSON.stringify(form) !== JSON.stringify(data.form)

  return (
    // Essential Loyalty's column: about 50rem, centred (tables stay full width).
    <div className="mx-auto flex w-full max-w-[50rem] flex-col gap-5">
      <SaveBar
        open={dirty || !data.reward}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={() => (data.reward ? setForm(data.form) : router.push(back.href))}
        saving={busy}
      />
      <PageHeader
        title={data.reward ? data.reward.title : copy.newTitle}
        back={back}
        summary={copy.types[form.type]}
        badges={
          <StatusChip tone={form.active ? 'success' : 'neutral'}>
            {form.active ? copy.enabled : copy.disabled}
          </StatusChip>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => set({ active: !form.active })}>
              {form.active ? copy.disable : copy.enable}
            </Button>
            {data.reward ? (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setRemoving(true)}
              >
                {copy.remove}
              </Button>
            ) : null}
          </>
        }
        save={{ dirty: dirty || !data.reward, saving: busy, onSave: handleSave, label: copy.save }}
      />
      <PageColumns
        main={
          <div className="flex flex-col gap-5">
            <RewardTypeCard form={form} onChange={setForm} />
            <RewardDetailsCard form={form} onChange={set} />
            <RewardRulesCard form={form} tiers={data.tiers} onChange={set} />
            <RewardLimitsCard
              form={form}
              used={data.reward ? data.reward.usedCount : null}
              onChange={set}
            />
          </div>
        }
        side={<RewardSummary form={form} reward={data.reward} tiers={data.tiers} />}
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={copy.removeTitle}
        body={copy.removeBody}
        confirmLabel={copy.remove}
        tone="destructive"
        onConfirm={handleRemove}
      />
    </div>
  )
}
