'use client'

import { AI_FEATURES, type AiFeatureToggles } from '@commerce/ai/client'
import { AiIcon, CircleAlert, ShieldCheck } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Progress } from '@commerce/ui/shadcn/progress'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { aiContent } from '@/data/ai'
import { settingsContent } from '@/data/settings'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Loaded = Awaited<ReturnType<typeof api.ai.settings>>

/** First day of the month after `YYYY-MM`, as a date the formatter can print. */
function nextMonthStart(month: string): Date {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 6))
}

function share(used: number, limit: number | null): number {
  return limit === null || limit <= 0 ? 0 : Math.min(100, (used / limit) * 100)
}

/** Settings → AI: this month's AI use against the plan, the feature switches, and what data is sent. */
export default function AiSettings() {
  // Hooks
  const copy = useCopy(aiContent)
  const settingsCopy = useCopy(settingsContent)
  const fmt = useFormat()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [features, setFeatures] = useState<AiFeatureToggles | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.ai
      .settings()
      .then((v) => {
        setLoaded(v)
        setFeatures(v.features)
      })
      .catch(() => setFailed(true))
  }, [])

  // Helpers
  const meter = (used: number, limit: number | null) =>
    limit === null
      ? copy.settings.usage.unlimited(fmt.number(used))
      : copy.settings.usage.of(fmt.number(used), fmt.number(limit))

  // Event handlers
  const handleSave = async () => {
    if (!features) return
    setBusy(true)
    try {
      const next = await api.ai.saveSettings({ features })
      setLoaded(next)
      setFeatures(next.features)
      toast.success(copy.settings.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.settings.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (failed) return <p className="text-body text-muted-foreground">{copy.settings.loadFailed}</p>

  // Render logic
  const dirty =
    loaded !== null &&
    features !== null &&
    JSON.stringify(features) !== JSON.stringify(loaded.features)
  const usage = loaded?.usage
  const tokens = usage ? usage.total.inputTokens + usage.total.outputTokens : 0

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={settingsCopy.general.unsaved}
        saveLabel={copy.settings.save}
        discardLabel={settingsCopy.general.discard}
        onSave={handleSave}
        onDiscard={() => loaded && setFeatures(loaded.features)}
        saving={busy}
      />
      <PageHeader
        title={copy.settings.title}
        subtitle={copy.settings.subtitle}
        icon={<AiIcon aria-hidden="true" />}
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
          <Card size="form">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {copy.settings.usage.heading}
                <Badge variant="neutral">
                  {copy.settings.usage.plan}: {copy.settings.usage.plans[loaded.plan]}
                </Badge>
              </CardTitle>
              <CardDescription>
                {copy.settings.usage.help(
                  fmt.pattern(nextMonthStart(usage.month), { day: 'numeric', month: 'long' }),
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-body">
                  <span className="text-ink-strong">{copy.settings.usage.requests}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {meter(usage.total.calls, loaded.quota.calls)}
                  </span>
                </div>
                {loaded.quota.calls === null ? null : (
                  <Progress value={share(usage.total.calls, loaded.quota.calls)} />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-body">
                  <span className="text-ink-strong">{copy.settings.usage.words}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {meter(tokens, loaded.quota.tokens)}
                  </span>
                </div>
                {loaded.quota.tokens === null ? null : (
                  <Progress value={share(tokens, loaded.quota.tokens)} />
                )}
                <p className="text-caption text-muted-foreground">
                  {copy.settings.usage.wordsHelp}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.settings.features.heading}</CardTitle>
              <CardDescription>{copy.settings.features.help}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {AI_FEATURES.map((feature) => (
                  <Field
                    key={feature}
                    orientation="horizontal"
                    className="items-start justify-between gap-4"
                  >
                    <div className="flex flex-col gap-0.5">
                      <FieldLabel htmlFor={`ai-${feature}`}>
                        {copy.settings.features[feature].label}
                      </FieldLabel>
                      <FieldDescription>{copy.settings.features[feature].help}</FieldDescription>
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {copy.settings.usage.requestCount(usage.byFeature[feature].calls)}
                      </span>
                    </div>
                    <Switch
                      id={`ai-${feature}`}
                      checked={features[feature]}
                      onCheckedChange={(on) => setFeatures({ ...features, [feature]: on })}
                    />
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
          <Card size="form">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                {copy.settings.privacy.heading}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body text-ink-strong">
                {copy.settings.privacy.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {loaded.configured ? (
                <p className="text-caption text-muted-foreground">
                  {copy.settings.privacy.model(loaded.models.askStore)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
