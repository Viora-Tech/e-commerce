'use client'

import type { AutopilotView } from '@commerce/api'
import {
  AUTOPILOT_GOALS,
  AUTOPILOT_LIMITS,
  type AutopilotGoal,
  type AutopilotSettings,
} from '@commerce/core/marketing'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { growthAutopilotContent } from '@/data/growth-home'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type AutopilotSettingsCardProps = {
  settings: AutopilotSettings
  onSaved: (next: AutopilotView) => void
}

/** A whole number between `min` and `max`, or the fallback when the field is not one. */
function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Autopilot's goals and its weekly budget: emails, campaigns and the largest discount. */
export default function AutopilotSettingsCard({ settings, onSaved }: AutopilotSettingsCardProps) {
  // Hooks
  const copy = useCopy(growthAutopilotContent)
  const [goals, setGoals] = useState<AutopilotGoal[]>(settings.goals)
  const [messages, setMessages] = useState(String(settings.maxMessagesPerWeek))
  const [campaigns, setCampaigns] = useState(String(settings.maxCampaignsPerWeek))
  const [discount, setDiscount] = useState(String(settings.maxDiscountPercent))
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleGoal = (goal: AutopilotGoal, on: boolean) => {
    setGoals((current) =>
      on
        ? AUTOPILOT_GOALS.filter((g) => g === goal || current.includes(g))
        : current.filter((g) => g !== goal),
    )
  }

  const handleSave = async () => {
    setBusy(true)
    try {
      const next = await api.marketing.autopilot.saveSettings({
        enabled: settings.enabled,
        goals,
        maxMessagesPerWeek: clampInt(
          messages,
          0,
          AUTOPILOT_LIMITS.maxMessagesPerWeek,
          settings.maxMessagesPerWeek,
        ),
        maxCampaignsPerWeek: clampInt(
          campaigns,
          1,
          AUTOPILOT_LIMITS.maxCampaignsPerWeek,
          settings.maxCampaignsPerWeek,
        ),
        maxDiscountPercent: clampInt(
          discount,
          0,
          AUTOPILOT_LIMITS.maxDiscountPercent,
          settings.maxDiscountPercent,
        ),
      })
      onSaved(next)
      setMessages(String(next.settings.maxMessagesPerWeek))
      setCampaigns(String(next.settings.maxCampaignsPerWeek))
      setDiscount(String(next.settings.maxDiscountPercent))
      toast.success(copy.settings.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const s = copy.settings

  return (
    <DataCard title={s.title} subtitle={s.subtitle} bodyClassName="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-eyebrow text-muted-foreground">{s.goalsLabel}</legend>
        {AUTOPILOT_GOALS.map((goal) => (
          <Label key={goal} className="flex items-start gap-3 font-normal">
            <Checkbox
              className="mt-0.5"
              checked={goals.includes(goal)}
              onCheckedChange={(on) => handleGoal(goal, Boolean(on))}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-body-strong text-foreground">{s.goals[goal].label}</span>
              <span className="text-caption text-muted-foreground">{s.goals[goal].body}</span>
            </span>
          </Label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-eyebrow text-muted-foreground">{s.budgetLabel}</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Label className="flex flex-col items-start gap-1.5 font-normal">
            <span className="text-body text-foreground">{s.messages}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={AUTOPILOT_LIMITS.maxMessagesPerWeek}
              value={messages}
              onChange={(e) => setMessages(e.target.value)}
            />
            <span className="text-caption text-muted-foreground">{s.messagesHelp}</span>
          </Label>
          <Label className="flex flex-col items-start gap-1.5 font-normal">
            <span className="text-body text-foreground">{s.campaigns}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={AUTOPILOT_LIMITS.maxCampaignsPerWeek}
              value={campaigns}
              onChange={(e) => setCampaigns(e.target.value)}
            />
          </Label>
          <Label className="flex flex-col items-start gap-1.5 font-normal">
            <span className="text-body text-foreground">{s.discount}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={AUTOPILOT_LIMITS.maxDiscountPercent}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
            <span className="text-caption text-muted-foreground">{s.discountHelp}</span>
          </Label>
        </div>
      </fieldset>
      <Button className="self-end" disabled={busy} onClick={() => void handleSave()}>
        {s.save}
      </Button>
    </DataCard>
  )
}
