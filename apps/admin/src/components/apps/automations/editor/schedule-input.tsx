'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import SelectInput from './select-input'

type Every = 'hour' | 'day' | 'week'

type ScheduleInputProps = {
  id: string
  config: Record<string, unknown>
  onPatch: (patch: Record<string, unknown>) => void
}

const EVERY: Every[] = ['hour', 'day', 'week']

/** The scheduled trigger's repeat: hourly, daily at a time, or weekly on a day and time (IST). */
export default function ScheduleInput({ id, config, onPatch }: ScheduleInputProps) {
  // Hooks
  const { fields: copy } = useCopy(automationEditorContent)

  // Render logic
  const every = (EVERY as string[]).includes(String(config.every)) ? (config.every as Every) : null
  const at = typeof config.at === 'string' ? config.at : '09:00'
  const weekday = typeof config.weekday === 'number' ? config.weekday : 1

  return (
    <div className="flex flex-col gap-3">
      <SelectInput
        id={id}
        value={every}
        options={EVERY.map((e) => ({ value: e, label: copy.schedule[e] }))}
        onChange={(v) =>
          onPatch(
            v === 'hour'
              ? { every: v, at: undefined, weekday: undefined }
              : v === 'day'
                ? { every: v, at, weekday: undefined }
                : { every: v, at, weekday },
          )
        }
      />
      {every === 'week' ? (
        <Field>
          <FieldLabel htmlFor={`${id}-weekday`}>{copy.weekday}</FieldLabel>
          <SelectInput
            id={`${id}-weekday`}
            value={String(weekday)}
            options={copy.weekdays.map((label, i) => ({ value: String(i), label }))}
            onChange={(v) => onPatch({ weekday: Number(v) })}
          />
        </Field>
      ) : null}
      {every === 'day' || every === 'week' ? (
        <Field>
          <FieldLabel htmlFor={`${id}-at`}>{copy.at}</FieldLabel>
          <Input
            id={`${id}-at`}
            type="time"
            value={at}
            onChange={(e) => onPatch({ at: e.target.value })}
          />
        </Field>
      ) : null}
    </div>
  )
}
