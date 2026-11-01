'use client'

import type { RolloutMarketOption } from '@commerce/core'
import { InfoIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Slider } from '@commerce/ui/shadcn/slider'
import { Switch } from '@commerce/ui/shadcn/switch'
import DataCard from '@/components/layout/data-card'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import { type AudienceForm, DEFAULT_AUDIENCE } from './rollout-form-state'

type RolloutAudienceCardProps = {
  audience: AudienceForm | null
  markets: RolloutMarketOption[]
  /** The test can be switched on or off only before the rollout starts. */
  toggleDisabled: boolean
  /** Split, traffic and markets are fixed once the test runs; the target stays editable. */
  audienceLocked: boolean
  targetDisabled: boolean
  onChange: (audience: AudienceForm | null) => void
}

const sliderValue = (v: number | readonly number[]): number =>
  typeof v === 'number' ? v : (v[0] ?? 0)

/**
 * Shopify's rollout Audience: run the rollout as an A/B test (Control vs Treatment), with its
 * split, traffic allocation, eligible markets and the visitors it aims to reach.
 */
export default function RolloutAudienceCard({
  audience,
  markets,
  toggleDisabled,
  audienceLocked,
  targetDisabled,
  onChange,
}: RolloutAudienceCardProps) {
  // Hooks
  const { form } = useCopy(rolloutsContent)

  // Helpers
  const patch = (p: Partial<AudienceForm>) => {
    if (audience) onChange({ ...audience, ...p })
  }

  // Event handlers
  const handleToggle = (on: boolean) => onChange(on ? { ...DEFAULT_AUDIENCE } : null)

  const handleMarket = (id: string, on: boolean) => {
    if (!audience) return
    const rest = audience.marketIds.filter((m) => m !== id)
    patch({ marketIds: on ? [...rest, id] : rest })
  }

  // Render logic
  const copy = form.audience

  return (
    <DataCard title={copy.heading} subtitle={copy.subtitle}>
      <FieldGroup>
        <Field>
          <Label
            htmlFor="rollout-ab-toggle"
            className="flex items-center gap-2 text-body font-medium text-foreground"
          >
            <Switch
              id="rollout-ab-toggle"
              checked={audience !== null}
              disabled={toggleDisabled}
              onCheckedChange={handleToggle}
            />
            {copy.toggle}
          </Label>
          <FieldDescription>{copy.toggleHelp}</FieldDescription>
        </Field>

        {audience ? (
          <>
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-caption text-muted-foreground">
              <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {copy.splittable}
            </p>

            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="rollout-ab-split">{copy.split}</FieldLabel>
                <span className="text-body text-muted-foreground tabular-nums">
                  {copy.splitValue(100 - audience.split, audience.split)}
                </span>
              </div>
              <Slider
                id="rollout-ab-split"
                min={1}
                max={99}
                step={1}
                value={[audience.split]}
                disabled={audienceLocked}
                aria-label={copy.split}
                onValueChange={(v) => patch({ split: sliderValue(v) })}
              />
              <div className="flex items-center justify-between text-caption text-muted-foreground">
                <span>{copy.control}</span>
                {audience.split !== 50 && !audienceLocked ? (
                  <Button variant="ghost" size="sm" onClick={() => patch({ split: 50 })}>
                    {copy.reset}
                  </Button>
                ) : null}
                <span>{copy.treatment}</span>
              </div>
            </Field>

            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="rollout-ab-traffic">{copy.traffic}</FieldLabel>
                <span className="text-body text-muted-foreground tabular-nums">
                  {copy.trafficValue(audience.traffic)}
                </span>
              </div>
              <Slider
                id="rollout-ab-traffic"
                min={1}
                max={100}
                step={1}
                value={[audience.traffic]}
                disabled={audienceLocked}
                aria-label={copy.traffic}
                onValueChange={(v) => patch({ traffic: sliderValue(v) })}
              />
              <FieldDescription>{copy.trafficHelp}</FieldDescription>
            </Field>

            {markets.length > 0 ? (
              <Field>
                <FieldLabel>{copy.markets}</FieldLabel>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {markets.map((m) => (
                    <label
                      key={m.id}
                      htmlFor={`rollout-ab-market-${m.id}`}
                      className="flex items-center gap-2 text-body"
                    >
                      <Checkbox
                        id={`rollout-ab-market-${m.id}`}
                        checked={audience.marketIds.includes(m.id)}
                        disabled={audienceLocked}
                        onCheckedChange={(on) => handleMarket(m.id, on === true)}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
                <FieldDescription>{copy.marketsHelp}</FieldDescription>
              </Field>
            ) : null}

            <Field className="max-w-xs">
              <FieldLabel htmlFor="rollout-ab-target">{copy.target}</FieldLabel>
              <Input
                id="rollout-ab-target"
                size="lg"
                inputMode="numeric"
                value={audience.target}
                placeholder={copy.targetPlaceholder}
                disabled={targetDisabled}
                onChange={(e) => patch({ target: e.target.value.replace(/[^0-9]/g, '') })}
              />
              <FieldDescription>{copy.targetHelp}</FieldDescription>
            </Field>

            <FieldDescription>{audienceLocked ? copy.locked : copy.who}</FieldDescription>
          </>
        ) : null}
      </FieldGroup>
    </DataCard>
  )
}
