'use client'

import type { TriggerView, WorkflowDefinition } from '@commerce/core/automations'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { automationEditorContent, automationPiecesContent } from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { triggerLabel } from '@/lib/automation-labels'
import FieldInput from './field-input'

type TriggerPanelProps = {
  def: WorkflowDefinition
  trigger: TriggerView | null
  mergeTags: string[]
  readOnly: boolean
  onChange: (def: WorkflowDefinition) => void
  onChangeTrigger: () => void
}

/** The trigger's settings (test orders, delay, schedule) and the workflow-wide settings. */
export default function TriggerPanel({
  def,
  trigger,
  mergeTags,
  readOnly,
  onChange,
  onChangeTrigger,
}: TriggerPanelProps) {
  // Hooks
  const { panel: copy } = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()

  // Render logic
  const marketing = trigger?.group === 'marketing'

  return (
    <fieldset disabled={readOnly} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-body-strong text-ink-strong">
          {triggerLabel(pieces, locale, trigger, def.trigger.type)}
        </p>
        <p className="text-caption text-muted-foreground">{copy.triggerHelp}</p>
        {readOnly ? null : (
          <Button variant="outline" size="sm" className="mt-1 self-start" onClick={onChangeTrigger}>
            {copy.changeTrigger}
          </Button>
        )}
      </div>
      {(trigger?.configFields ?? []).map((spec) => (
        <FieldInput
          key={spec.key}
          idPrefix="trigger"
          spec={spec}
          config={def.trigger.config}
          mergeTags={mergeTags}
          invalid={false}
          onPatch={(patch) =>
            onChange({
              ...def,
              trigger: { ...def.trigger, config: { ...def.trigger.config, ...patch } },
            })
          }
        />
      ))}
      <h3 className="mt-2 text-eyebrow text-muted-foreground">{copy.settings}</h3>
      <Field>
        <FieldLabel htmlFor="settings-dedupe">{copy.dedupe}</FieldLabel>
        <div className="flex items-center gap-2">
          <Input
            id="settings-dedupe"
            type="number"
            min={0}
            className="w-28"
            value={def.settings.dedupeMinutes ?? 0}
            onChange={(e) =>
              onChange({
                ...def,
                settings: {
                  ...def.settings,
                  dedupeMinutes: Math.max(0, Math.round(Number(e.target.value) || 0)),
                },
              })
            }
          />
          <span className="text-body text-muted-foreground">{copy.units.minutes}</span>
        </div>
        <FieldDescription>{copy.dedupeHelp}</FieldDescription>
      </Field>
      {marketing ? (
        <label
          htmlFor="settings-exit"
          className="flex items-center justify-between gap-3 text-body"
        >
          <span>{copy.exitOnOrder}</span>
          <Switch
            id="settings-exit"
            checked={def.settings.exitOnOrder === true}
            onCheckedChange={(on) =>
              onChange({ ...def, settings: { ...def.settings, exitOnOrder: on } })
            }
          />
        </label>
      ) : null}
    </fieldset>
  )
}
