'use client'

import {
  AI_FEATURES,
  type AiFeatureToggles,
  WRITING_QUALITIES,
  type WritingQuality,
} from '@commerce/ai/client'
import { AI_CREDIT_PACK } from '@commerce/core/billing'
import { CircleAlert, ShieldCheck } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Progress } from '@commerce/ui/shadcn/progress'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { aiContent } from '@/data/ai'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import AiActivityCard from './ai-activity-card'
import SettingsCard from './settings-card'
import SettingsRow from './settings-row'
import SettingsToggleRow from './settings-toggle-row'

type Loaded = Awaited<ReturnType<typeof api.ai.settings>>

/** First day of the month after `YYYY-MM`, as a date the formatter can print. */
function nextMonthStart(month: string): Date {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 6))
}

function share(used: number, limit: number | null): number {
  return limit === null || limit <= 0 ? 0 : Math.min(100, (used / limit) * 100)
}

/** At or past this share of the monthly limit the count turns amber (Figma "Near the monthly limit"). */
const NEAR_LIMIT = 90

function countTone(used: number, limit: number | null): string {
  return share(used, limit) >= NEAR_LIMIT ? 'text-warning' : 'text-muted-foreground'
}

/**
 * Settings → AI: this month's AI use against the plan, the feature switches and writing quality,
 * what data is sent, and the Activity log of every change the AI made (with Undo).
 */
export default function AiSettings() {
  // Hooks
  const copy = useCopy(aiContent)
  const settingsCopy = useCopy(settingsContent)
  const fmt = useFormat()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [features, setFeatures] = useState<AiFeatureToggles | null>(null)
  const [quality, setQuality] = useState<WritingQuality>('standard')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [buying, setBuying] = useState(false)

  useEffect(() => {
    api.ai
      .settings()
      .then((v) => {
        setLoaded(v)
        setFeatures(v.features)
        setQuality(v.writingQuality)
      })
      .catch(() => setFailed(true))
  }, [])

  // Helpers
  // Every plan, Pro included, has a monthly credit cap; the meter always shows it.
  const meter = (used: number, limit: number) =>
    copy.settings.usage.of(fmt.number(used), fmt.number(limit))

  // Event handlers
  const handleSave = async () => {
    if (!features) return
    setBusy(true)
    try {
      const next = await api.ai.saveSettings({ features, writingQuality: quality })
      setLoaded(next)
      setFeatures(next.features)
      setQuality(next.writingQuality)
      toast.success(copy.settings.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.settings.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleBuyCredits = async () => {
    setBuying(true)
    try {
      const bill = await api.billing.buyCredits()
      if (bill.url) window.location.assign(bill.url)
      else toast.error(copy.settings.usage.buyFailed)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.settings.usage.buyFailed)
    } finally {
      setBuying(false)
    }
  }

  // Early returns
  if (failed) return <p className="text-body text-muted-foreground">{copy.settings.loadFailed}</p>

  // Render logic
  const dirty =
    loaded !== null &&
    features !== null &&
    (JSON.stringify(features) !== JSON.stringify(loaded.features) ||
      quality !== loaded.writingQuality)
  const usage = loaded?.usage
  const credits = usage ? Math.ceil(usage.total.credits) : 0

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={settingsCopy.general.unsaved}
        saveLabel={copy.settings.save}
        discardLabel={settingsCopy.general.discard}
        onSave={handleSave}
        onDiscard={() => {
          if (!loaded) return
          setFeatures(loaded.features)
          setQuality(loaded.writingQuality)
        }}
        saving={busy}
      />
      <PageHeader
        title={copy.settings.title}
        subtitle={copy.settings.subtitle}
        back={SETTINGS_BACK}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.settings.save }}
      />
      {!loaded || !features || !usage ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <>
          {loaded.configured ? null : (
            <Alert>
              <CircleAlert />
              <AlertTitle>{copy.settings.off.title}</AlertTitle>
              <AlertDescription>{copy.settings.off.body}</AlertDescription>
            </Alert>
          )}
          <DataCard
            title={
              <>
                {copy.settings.usage.heading}
                <Badge variant="neutral">
                  {copy.settings.usage.plan}: {copy.settings.usage.plans[loaded.plan]}
                </Badge>
              </>
            }
            subtitle={copy.settings.usage.help(
              fmt.pattern(nextMonthStart(usage.month), { day: 'numeric', month: 'long' }),
            )}
            bodyClassName="flex flex-col gap-5"
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-body">
                <span className="text-ink-strong">{copy.settings.usage.credits}</span>
                <span className={`tabular-nums ${countTone(credits, loaded.quota.credits)}`}>
                  {meter(credits, loaded.quota.credits)}
                </span>
              </div>
              <Progress value={share(credits, loaded.quota.credits)} />
              <p className="text-caption text-muted-foreground">
                {copy.settings.usage.creditsHelp}
              </p>
              {loaded.extraCredits > 0 ? (
                <p className="text-caption text-foreground">
                  {copy.settings.usage.extra(fmt.number(Math.floor(loaded.extraCredits)))}
                </p>
              ) : null}
            </div>
            <Button
              variant="outline"
              className="self-start"
              loading={buying}
              onClick={handleBuyCredits}
            >
              {copy.settings.usage.buy(fmt.money(AI_CREDIT_PACK.pricePaise))}
            </Button>
          </DataCard>
          <SettingsCard
            title={copy.settings.features.heading}
            description={copy.settings.features.help}
          >
            {AI_FEATURES.map((feature) => (
              <SettingsToggleRow
                key={feature}
                id={`ai-${feature}`}
                label={copy.settings.features[feature].label}
                description={copy.settings.features[feature].help}
                checked={features[feature]}
                onChange={(on) => setFeatures({ ...features, [feature]: on })}
              >
                <span className="text-caption text-muted-foreground tabular-nums">
                  {copy.settings.usage.requestCount(usage.byFeature[feature].calls)}
                </span>
              </SettingsToggleRow>
            ))}
            <SettingsRow
              label={copy.settings.quality.label}
              description={copy.settings.quality.help}
            >
              <RadioGroup
                value={quality}
                onValueChange={(v) => setQuality(v as WritingQuality)}
                className="flex flex-wrap gap-4"
              >
                {WRITING_QUALITIES.map((q) => (
                  <label key={q} htmlFor={`ai-quality-${q}`} className="flex items-center gap-2">
                    <RadioGroupItem id={`ai-quality-${q}`} value={q} />
                    <span className="text-body">{copy.settings.quality[q]}</span>
                  </label>
                ))}
              </RadioGroup>
            </SettingsRow>
          </SettingsCard>
          <DataCard
            title={
              <>
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                {copy.settings.privacy.heading}
              </>
            }
            bodyClassName="flex flex-col gap-3"
          >
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink-strong">
              {copy.settings.privacy.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {loaded.configured ? (
              <p className="text-caption text-muted-foreground">
                {copy.settings.privacy.model(loaded.models.fast, loaded.models.strong)}
              </p>
            ) : null}
          </DataCard>
          <AiActivityCard />
        </>
      )}
    </div>
  )
}
