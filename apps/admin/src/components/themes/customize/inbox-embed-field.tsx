'use client'

import type { InboxWidget, InboxWidgetField } from '@commerce/core/inbox'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useId, useState } from 'react'
import { itemTabs } from '@/components/discounts/pick-sources'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import { customizeInboxEmbedContent } from '@/data/customize-inbox-embed'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { FIELD_INPUT } from '@/lib/customize-field-styles'
import CustomizeNumberField from './customize-number-field'
import CustomizeSelectField from './customize-select-field'
import FieldFrame from './field-frame'

type InboxEmbedFieldProps = {
  field: InboxWidgetField
  widget: InboxWidget
  onChange: (patch: Partial<InboxWidget>) => void
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** One field of the Inbox embed, drawn with the editor's own controls (`INBOX_WIDGET_FIELDS`). */
export default function InboxEmbedField({ field, widget, onChange }: InboxEmbedFieldProps) {
  // Hooks
  const copy = useCopy(customizeInboxEmbedContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()
  const id = useId()
  const [picking, setPicking] = useState(false)

  // Helpers
  const set = (next: unknown) => onChange({ [field.key]: next } as Partial<InboxWidget>)
  const value = widget[field.key]

  // Early returns
  if (field.type === 'switch') {
    return (
      <FieldFrame label={field.label} inline htmlFor={id}>
        <Switch id={id} checked={value === true} onCheckedChange={(on) => set(on)} />
      </FieldFrame>
    )
  }
  if (field.type === 'text') {
    return (
      <FieldFrame label={field.label} htmlFor={id}>
        <Input
          id={id}
          value={typeof value === 'string' ? value : ''}
          maxLength={field.max}
          placeholder={field.placeholder}
          onChange={(e) => set(e.target.value)}
          className={FIELD_INPUT}
        />
      </FieldFrame>
    )
  }
  if (field.type === 'colour') {
    const hex = typeof value === 'string' ? value : ''
    return (
      <FieldFrame label={field.label} htmlFor={id}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={field.label}
            value={HEX.test(hex) ? hex : '#000000'}
            onChange={(e) => set(e.target.value)}
            className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          />
          <Input
            id={id}
            value={hex}
            placeholder={copy.themeColour}
            onChange={(e) => {
              const next = e.target.value.trim()
              if (next === '' || HEX.test(next)) set(next)
            }}
            className={FIELD_INPUT}
          />
        </div>
      </FieldFrame>
    )
  }
  if (field.type === 'select') {
    return (
      <CustomizeSelectField
        name={field.key}
        field={{ label: field.label, options: field.options }}
        value={typeof value === 'string' ? value : ''}
        onChange={(next) => set(next)}
      />
    )
  }
  if (field.type === 'range') {
    return (
      <CustomizeNumberField
        name={field.key}
        field={{ label: field.label, min: field.min, max: field.max, step: 1 }}
        value={typeof value === 'number' ? value : field.min}
        onChange={(next) => set(Math.round(next))}
      />
    )
  }
  // Render logic
  const ids = Array.isArray(value) ? (value as string[]) : []
  const tabs = itemTabs(discountCopy.value, locale).filter((x) => x.key === 'products')
  return (
    <FieldFrame label={field.label}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{copy.pickedProducts(ids.length)}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
          {copy.pickProducts}
        </Button>
      </div>
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
      <ResourcePickDialog
        open={picking}
        title={copy.pickProducts}
        tabs={tabs}
        selected={{ tab: 'products', ids }}
        onClose={() => setPicking(false)}
        onDone={(r) => {
          set(r.ids.slice(0, field.max))
          setPicking(false)
        }}
      />
    </FieldFrame>
  )
}
