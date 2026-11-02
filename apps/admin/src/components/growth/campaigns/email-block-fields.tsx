'use client'

import type { EmailBlock } from '@commerce/core/marketing'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import DiscountCodeField from './discount-code-field'
import EmailImageField from './email-image-field'
import EmailProductsPicker from './email-products-picker'

type EmailBlockFieldsProps = {
  block: EmailBlock
  onChange: (block: EmailBlock) => void
}

type TextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  help?: string | undefined
  placeholder?: string | undefined
}

const copy = campaignEditorContent.fields

function TextField({ id, label, value, onChange, help, placeholder }: TextFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  )
}

type NumberFieldProps = {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  help?: string | undefined
}

function NumberField({ id, label, value, min, max, onChange, help }: NumberFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value))
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
      />
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  )
}

/** The settings of one email block; which fields show depends on the block type. */
export default function EmailBlockFields({ block, onChange }: EmailBlockFieldsProps) {
  // Helpers
  const id = (field: string) => `${block.id}-${field}`

  // Render logic
  switch (block.type) {
    case 'header':
      return (
        <TextField
          id={id('logo')}
          label={copy.logoUrl}
          help={copy.logoHelp}
          value={block.logoUrl ?? ''}
          onChange={(logoUrl) => onChange({ ...block, logoUrl: logoUrl || undefined })}
        />
      )
    case 'text':
      return (
        <FieldGroup>
          <TextField
            id={id('heading')}
            label={copy.heading}
            value={block.heading ?? ''}
            onChange={(heading) => onChange({ ...block, heading })}
          />
          <Field>
            <FieldLabel htmlFor={id('text')}>{copy.text}</FieldLabel>
            <Textarea
              id={id('text')}
              rows={5}
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
            <FieldDescription>{copy.textHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{copy.align}</FieldLabel>
            <ToggleGroup
              value={[block.align]}
              onValueChange={(v) =>
                v[0] && onChange({ ...block, align: v[0] as 'left' | 'center' })
              }
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="left">{copy.alignLeft}</ToggleGroupItem>
              <ToggleGroupItem value="center">{copy.alignCenter}</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>
      )
    case 'image':
      return (
        <FieldGroup>
          <EmailImageField
            id={id('url')}
            value={block.url}
            onChange={(url) => onChange({ ...block, url })}
          />
          <TextField
            id={id('alt')}
            label={copy.alt}
            value={block.alt}
            onChange={(alt) => onChange({ ...block, alt })}
          />
          <TextField
            id={id('href')}
            label={copy.link}
            placeholder="https://"
            value={block.href ?? ''}
            onChange={(href) => onChange({ ...block, href: href || undefined })}
          />
        </FieldGroup>
      )
    case 'button':
      return (
        <FieldGroup>
          <TextField
            id={id('label')}
            label={copy.label}
            value={block.label}
            onChange={(label) => onChange({ ...block, label })}
          />
          <TextField
            id={id('url')}
            label={copy.url}
            value={block.url}
            onChange={(url) => onChange({ ...block, url })}
          />
        </FieldGroup>
      )
    case 'products':
      return (
        <FieldGroup>
          <TextField
            id={id('heading')}
            label={copy.productsHeading}
            value={block.heading ?? ''}
            onChange={(heading) => onChange({ ...block, heading })}
          />
          <EmailProductsPicker
            items={block.items}
            onChange={(items) => onChange({ ...block, items })}
          />
        </FieldGroup>
      )
    case 'discount':
      return (
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch
              id={id('unique')}
              checked={Boolean(block.unique)}
              onCheckedChange={(on) =>
                onChange({ ...block, unique: on ? { percent: 10, days: 14 } : undefined })
              }
            />
            <FieldLabel htmlFor={id('unique')}>{copy.uniqueCode}</FieldLabel>
          </Field>
          {block.unique ? (
            <>
              <NumberField
                id={id('percent')}
                label={copy.uniquePercent}
                value={block.unique.percent}
                min={1}
                max={90}
                onChange={(percent) =>
                  onChange({ ...block, unique: { days: 14, ...block.unique, percent } })
                }
              />
              <NumberField
                id={id('days')}
                label={copy.uniqueDays}
                help={copy.uniqueHelp}
                value={block.unique.days}
                min={1}
                max={365}
                onChange={(days) =>
                  onChange({ ...block, unique: { percent: 10, ...block.unique, days } })
                }
              />
            </>
          ) : (
            <DiscountCodeField
              id={id('code')}
              value={block.code}
              onChange={(code) => onChange({ ...block, code })}
            />
          )}
          <TextField
            id={id('heading')}
            label={copy.heading}
            value={block.heading ?? ''}
            onChange={(heading) => onChange({ ...block, heading })}
          />
          <TextField
            id={id('note')}
            label={copy.note}
            value={block.note ?? ''}
            onChange={(note) => onChange({ ...block, note })}
          />
        </FieldGroup>
      )
    case 'cart':
      return <p className="text-caption text-muted-foreground">{copy.cartNote}</p>
    case 'divider':
      return null
  }
}
