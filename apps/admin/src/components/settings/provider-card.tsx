'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Separator } from '@commerce/ui/shadcn/separator'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { providerSettingsContent as copy } from '@/data/provider-settings'

/** One field of a provider's config, as its factory declares it. */
export type ProviderFieldDef = {
  key: string
  label: string
  secret?: boolean | undefined
  required?: boolean | undefined
  multiline?: boolean | undefined
  type?: 'text' | 'boolean' | undefined
  help?: string | undefined
}

export type ProviderDef = { id: string; label: string; fields: ProviderFieldDef[] }

type ProviderCardProps = {
  provider: ProviderDef
  enabled: boolean
  values: Record<string, string>
  onToggle: (on: boolean) => void
  onField: (key: string, value: string) => void
  /** Under the fields, e.g. a webhook URL or dashboard hint; providers without fields use noConfigText. */
  hint?: ReactNode
  /** A plain line on what this method is, at the top of the card whether or not it has fields. */
  description?: ReactNode
  /** Under the hint when enabled, e.g. fee/discount for a payment method. */
  extra?: ReactNode
  noConfigText?: string | undefined
}

const fieldId = (providerId: string, key: string) => `provider-${providerId}-${key}`

type ProviderFieldProps = {
  providerId: string
  field: ProviderFieldDef
  value: string
  onChange: (value: string) => void
}

function ProviderField({ providerId, field: f, value, onChange }: ProviderFieldProps) {
  // Early returns
  const id = fieldId(providerId, f.key)
  if (f.type === 'boolean') {
    return (
      <Field orientation="horizontal">
        <Checkbox
          id={id}
          checked={value === 'true'}
          onCheckedChange={(v) => onChange(v ? 'true' : 'false')}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={id} className="font-normal">
            {f.label}
          </FieldLabel>
          {f.help ? <FieldDescription>{f.help}</FieldDescription> : null}
        </div>
      </Field>
    )
  }

  // Render logic
  const help = f.secret ? copy.secretHelp : f.help

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {f.label}
        {f.required ? (
          <span title={copy.required} className="text-destructive">
            *
          </span>
        ) : null}
      </FieldLabel>
      {f.multiline ? (
        <Textarea
          size="lg"
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          size="lg"
          id={id}
          type={f.secret ? 'password' : 'text'}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  )
}

/** A provider (gateway, courier, channel): enable switch, its declared fields, page-specific extras. */
export default function ProviderCard({
  provider,
  enabled,
  values,
  onToggle,
  onField,
  hint,
  description,
  extra,
  noConfigText,
}: ProviderCardProps) {
  const switchId = `provider-${provider.id}-enabled`

  return (
    <DataCard
      title={
        <>
          {provider.label}
          <StatusLabel
            kind="provider"
            value={enabled ? 'enabled' : 'disabled'}
            size="sm"
            label={enabled ? copy.active : copy.off}
          />
        </>
      }
      action={
        <label htmlFor={switchId} className="flex items-center gap-2 text-body">
          <span className="text-muted-foreground">{copy.enabled}</span>
          <Switch id={switchId} checked={enabled} onCheckedChange={onToggle} />
        </label>
      }
      bodyClassName="flex flex-col gap-5"
    >
      {description ? <div className="text-body text-muted-foreground">{description}</div> : null}
      {provider.fields.length > 0 ? (
        <FieldGroup>
          {provider.fields.map((f) => (
            <ProviderField
              key={f.key}
              providerId={provider.id}
              field={f}
              value={values[f.key] ?? ''}
              onChange={(v) => onField(f.key, v)}
            />
          ))}
        </FieldGroup>
      ) : (
        <p className="text-body text-muted-foreground">{noConfigText ?? copy.noConfig}</p>
      )}
      {hint && provider.fields.length > 0 ? (
        <div className="text-caption leading-relaxed text-muted-foreground-soft">{hint}</div>
      ) : null}
      {enabled && extra ? (
        <>
          <Separator />
          {extra}
        </>
      ) : null}
    </DataCard>
  )
}
