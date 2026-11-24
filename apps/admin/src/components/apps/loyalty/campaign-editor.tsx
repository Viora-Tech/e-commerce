'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import CampaignPreview from '@/components/apps/loyalty/campaign-preview'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import DateTimeInput from '@/components/metaobjects/date-time-input'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { multiplierBpFrom, multiplierLabel } from '@/lib/loyalty-campaigns'
import { routes } from '@/lib/routes'

type Campaign = Awaited<ReturnType<typeof api.loyalty.campaigns.list>>[number]
type Tier = Awaited<ReturnType<typeof api.loyalty.tiers.list>>[number]

export type CampaignDraft = {
  name: string
  startsAt: string | null
  endsAt: string | null
  who: 'all' | 'tiers'
  tierIds: string[]
  bonusType: 'multiplier' | 'fixed'
  multiplier: string
  points: string
}

const DAY_MS = 86_400_000

function blankDraft(now: Date): CampaignDraft {
  const start = new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000)
  return {
    name: '',
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 7 * DAY_MS).toISOString(),
    who: 'all',
    tierIds: [],
    bonusType: 'multiplier',
    multiplier: '2',
    points: '50',
  }
}

function draftOf(c: Campaign): CampaignDraft {
  return {
    name: c.name,
    startsAt: new Date(c.startsAt).toISOString(),
    endsAt: new Date(c.endsAt).toISOString(),
    who: c.tierIds.length ? 'tiers' : 'all',
    tierIds: c.tierIds,
    bonusType: c.bonusType,
    multiplier: multiplierLabel(c.multiplierBp).replace(/x$/, ''),
    points: String(c.bonusPoints || 50),
  }
}

/** Whole points above 0, or null. */
function pointsFrom(text: string): number | null {
  const n = Number(text.trim())
  return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : null
}

/** The campaign id in the path, null for `campaigns/new`. */
function idOf(params: AppPageProps['params']): string | null {
  return params.id && params.id !== 'new' ? params.id : null
}

type Loaded = { campaign: Campaign | null; tiers: Tier[] }

/** What the form shows: the merchant's edits, else the saved campaign, else a blank one. */
function formOf(draft: CampaignDraft | null, data: Loaded | null, id: string | null) {
  if (draft) return draft
  if (!data || (id && !data.campaign)) return null
  return data.campaign ? draftOf(data.campaign) : blankDraft(new Date())
}

/** New campaign (`campaigns/new`) or one to change: name, window, who, bonus and a preview. */
export default function LoyaltyCampaignEditor({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const router = useRouter()
  const { data, failed, retry } = useLoad<Loaded>(async () => {
    const id = idOf(params)
    const [campaigns, tiers] = await Promise.all([
      id ? api.loyalty.campaigns.list() : Promise.resolve([] as Campaign[]),
      api.loyalty.tiers.list(),
    ])
    return { campaign: id ? (campaigns.find((c) => c.id === id) ?? null) : null, tiers }
  }, [params.id])
  const [draft, setDraft] = useState<CampaignDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)

  // Helpers
  const current = () => formOf(draft, data, idOf(params))
  const patch = (p: Partial<CampaignDraft>) => {
    const form = current()
    if (form) setDraft({ ...form, ...p })
  }

  // Event handlers
  const handleSave = async () => {
    const form = current()
    if (!form) return
    setTried(true)
    const bp = multiplierBpFrom(form.multiplier)
    const pts = pointsFrom(form.points)
    const starts = form.startsAt ? new Date(form.startsAt) : null
    const ends = form.endsAt ? new Date(form.endsAt) : null
    const bonusOk = form.bonusType === 'multiplier' ? bp !== null : pts !== null
    const whoOk = form.who === 'all' || form.tierIds.length > 0
    if (!form.name.trim() || !starts || !ends || ends <= starts || !bonusOk || !whoOk) return
    setSaving(true)
    try {
      await api.loyalty.campaigns.save({
        id: idOf(params),
        campaign: {
          name: form.name.trim(),
          startsAt: starts,
          endsAt: ends,
          tierIds: form.who === 'all' ? [] : form.tierIds,
          bonusType: form.bonusType,
          multiplierBp: form.bonusType === 'multiplier' ? (bp ?? 10_000) : 10_000,
          bonusPoints: form.bonusType === 'fixed' ? (pts ?? 0) : 0,
          active: data?.campaign?.active ?? true,
        },
      })
      toast.success(copy.campaignForm.saved)
      router.push(routes.apps.page('loyalty', 'campaigns'))
    } catch (err) {
      toast.error(errorText(err, copy.campaignForm.failed))
    } finally {
      setSaving(false)
    }
  }

  const handleTier = (tierId: string, on: boolean) => {
    const form = current()
    if (!form) return
    patch({ tierIds: on ? [...form.tierIds, tierId] : form.tierIds.filter((t) => t !== tierId) })
  }

  // Early returns
  const k = copy.campaignForm
  const id = idOf(params)
  const form = current()
  const header = (
    <PageHeader
      title={id ? k.editTitle : k.newTitle}
      back={{ label: k.back, href: routes.apps.page('loyalty', 'campaigns') }}
      save={form ? { dirty: draft !== null, saving, onSave: handleSave, label: k.save } : undefined}
    />
  )

  if (failed) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <LoadFailedState size="page" heading={k.loadFailed} failed={failed} onRetry={retry} />
      </div>
    )
  }
  if (data && id && !data.campaign) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <p className="text-body text-muted-foreground">{k.notFound}</p>
      </div>
    )
  }
  if (!form || !data) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <DataCardSkeleton fields={3} />
        <DataCardSkeleton fields={2} />
      </div>
    )
  }

  // Render logic
  const tiers: Tier[] = data.tiers
  const badWindow =
    form.startsAt !== null &&
    form.endsAt !== null &&
    new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()
  const badMultiplier =
    form.bonusType === 'multiplier' && multiplierBpFrom(form.multiplier) === null
  const badPoints = form.bonusType === 'fixed' && pointsFrom(form.points) === null
  const badWho = form.who === 'tiers' && form.tierIds.length === 0

  return (
    <div className="flex flex-col gap-5">
      {header}
      <DataCard title={k.detailsTitle} bodyClassName="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="campaign-name">{k.name}</FieldLabel>
          <Input
            id="campaign-name"
            value={form.name}
            maxLength={120}
            placeholder={k.namePlaceholder}
            onChange={(e) => patch({ name: e.target.value })}
            aria-invalid={(tried && !form.name.trim()) || undefined}
          />
          <FieldDescription>{k.nameHelp}</FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="campaign-starts">{k.starts}</FieldLabel>
            <DateTimeInput
              id="campaign-starts"
              value={form.startsAt}
              onChange={(v) => patch({ startsAt: v })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="campaign-ends">{k.ends}</FieldLabel>
            <DateTimeInput
              id="campaign-ends"
              value={form.endsAt}
              invalid={badWindow}
              onChange={(v) => patch({ endsAt: v })}
            />
            {badWindow ? <FieldError>{k.endBeforeStart}</FieldError> : null}
          </Field>
        </div>
      </DataCard>
      <DataCard title={k.whoTitle} bodyClassName="flex flex-col gap-3">
        <RadioGroup
          value={form.who}
          onValueChange={(v) => patch({ who: v as CampaignDraft['who'] })}
        >
          <label htmlFor="campaign-all" className="flex items-center gap-2 text-body">
            <RadioGroupItem id="campaign-all" value="all" />
            {k.everyone}
          </label>
          <label htmlFor="campaign-tiers" className="flex items-center gap-2 text-body">
            <RadioGroupItem id="campaign-tiers" value="tiers" disabled={tiers.length === 0} />
            {k.someTiers}
          </label>
        </RadioGroup>
        {tiers.length === 0 ? (
          <p className="text-caption text-muted-foreground">{k.noTiers}</p>
        ) : null}
        {form.who === 'tiers' ? (
          <div className="flex flex-col gap-2 pl-6">
            {tiers.map((t) => (
              <label
                key={t.id}
                htmlFor={`campaign-tier-${t.id}`}
                className="flex items-center gap-2 text-body"
              >
                <Checkbox
                  id={`campaign-tier-${t.id}`}
                  checked={form.tierIds.includes(t.id)}
                  onCheckedChange={(on) => handleTier(t.id, on === true)}
                />
                {t.name}
              </label>
            ))}
            {badWho && tried ? <FieldError>{k.pickTier}</FieldError> : null}
          </div>
        ) : null}
      </DataCard>
      <DataCard title={k.bonusTitle} bodyClassName="flex flex-col gap-4">
        <RadioGroup
          value={form.bonusType}
          onValueChange={(v) => patch({ bonusType: v as CampaignDraft['bonusType'] })}
        >
          <label htmlFor="campaign-type-multiplier" className="flex flex-col gap-0.5 text-body">
            <span className="flex items-center gap-2">
              <RadioGroupItem id="campaign-type-multiplier" value="multiplier" />
              {k.multiplier}
            </span>
            <span className="pl-6 text-caption text-muted-foreground">{k.multiplierHelp}</span>
          </label>
          <label htmlFor="campaign-type-fixed" className="flex flex-col gap-0.5 text-body">
            <span className="flex items-center gap-2">
              <RadioGroupItem id="campaign-type-fixed" value="fixed" />
              {k.fixed}
            </span>
            <span className="pl-6 text-caption text-muted-foreground">{k.fixedHelp}</span>
          </label>
        </RadioGroup>
        {form.bonusType === 'multiplier' ? (
          <Field className="max-w-48">
            <FieldLabel htmlFor="campaign-multiplier">{k.multiplierField}</FieldLabel>
            <Input
              id="campaign-multiplier"
              inputMode="decimal"
              value={form.multiplier}
              onChange={(e) => patch({ multiplier: e.target.value })}
              aria-invalid={badMultiplier || undefined}
            />
            {badMultiplier ? <FieldError>{k.multiplierInvalid}</FieldError> : null}
          </Field>
        ) : (
          <Field className="max-w-48">
            <FieldLabel htmlFor="campaign-points">{k.pointsField}</FieldLabel>
            <Input
              id="campaign-points"
              inputMode="numeric"
              value={form.points}
              onChange={(e) => patch({ points: e.target.value })}
              aria-invalid={badPoints || undefined}
            />
            {badPoints ? <FieldError>{k.pointsInvalid}</FieldError> : null}
          </Field>
        )}
      </DataCard>
      <CampaignPreview draft={form} tiers={tiers} />
    </div>
  )
}
