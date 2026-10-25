'use client'

import {
  SIGNUP_FIELD_KINDS,
  type SignupField,
  type SignupFieldKind,
} from '@commerce/plugin-affiliates/settings'
import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import SettingsCard from '@/components/settings/settings-card'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'

type SignupFormCardProps = {
  fields: SignupField[]
  onChange: (fields: SignupField[]) => void
}

const MAX_FIELDS = 10

/** A stable id for a new question: its order and a short random tail. */
const newFieldId = (n: number) => `q${n}_${Math.random().toString(36).slice(2, 7)}`

/** Program › Signup questions: up to 10 extra questions on the program's signup page. */
export default function SignupFormCard({ fields, onChange }: SignupFormCardProps) {
  // Hooks
  const { program: copy } = useCopy(affiliatesContent)

  // Event handlers
  const handleField = (i: number, patch: Partial<SignupField>) =>
    onChange(fields.map((f, n) => (n === i ? { ...f, ...patch } : f)))
  const handleAdd = () =>
    onChange([
      ...fields,
      { id: newFieldId(fields.length + 1), label: '', kind: 'text', required: false, options: [] },
    ])
  const handleRemove = (i: number) => onChange(fields.filter((_, n) => n !== i))

  // Render logic
  const f = copy.form

  return (
    <SettingsCard title={f.title} description={f.description}>
      {fields.length === 0 ? <p className="text-body text-muted-foreground">{f.empty}</p> : null}
      <ol className="flex flex-col gap-3">
        {fields.map((field, i) => (
          <li key={field.id} className="flex flex-col gap-2 rounded-lg border border-hairline p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                aria-label={f.label}
                placeholder={f.labelPlaceholder}
                value={field.label}
                maxLength={120}
                onChange={(e) => handleField(i, { label: e.target.value })}
                className="flex-1"
              />
              <NativeSelect
                aria-label={f.kind}
                value={field.kind}
                onChange={(e) =>
                  handleField(i, {
                    kind:
                      SIGNUP_FIELD_KINDS.find((k): k is SignupFieldKind => k === e.target.value) ??
                      'text',
                  })
                }
                className="sm:w-40"
              >
                {SIGNUP_FIELD_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {f.kinds[k]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <label htmlFor={`aff-q-${field.id}`} className="flex items-center gap-2 text-body">
                <Switch
                  id={`aff-q-${field.id}`}
                  checked={field.required}
                  onCheckedChange={(required) => handleField(i, { required })}
                />
                {f.required}
              </label>
              <Button
                variant="ghost"
                size="icon"
                aria-label={f.remove}
                onClick={() => handleRemove(i)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            {field.kind === 'select' ? (
              <Input
                aria-label={f.options}
                placeholder={f.optionsPlaceholder}
                defaultValue={field.options.join(', ')}
                onBlur={(e) =>
                  handleField(i, {
                    options: e.target.value
                      .split(',')
                      .map((o) => o.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  })
                }
              />
            ) : null}
          </li>
        ))}
      </ol>
      {fields.length < MAX_FIELDS ? (
        <div>
          <Button variant="outline" onClick={handleAdd}>
            {f.add}
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  )
}
