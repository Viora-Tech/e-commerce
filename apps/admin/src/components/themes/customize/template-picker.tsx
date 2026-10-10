'use client'

import type { ALTERNATE_KINDS, TemplateKind } from '@commerce/core/theme'
import { ChevronDown, Home, Loader2Icon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import TemplateList from './template-list'

export type TemplateRef = { key: TemplateKind; suffix: string }
type AlternateKind = (typeof ALTERNATE_KINDS)[number]

type TemplatePickerProps = {
  value: TemplateRef
  /** Stored alternates of this theme, by kind. */
  alternates: { template: string; suffix: string }[]
  /** A template switch is in flight; the trigger shows a spinner instead of blocking. */
  loading?: boolean
  onChange: (ref: TemplateRef) => void
  /** Kind is the group "Create template" was clicked in, when it supports alternates. */
  onCreate: (kind: AlternateKind) => void
}

const copy = customizeContent.templates

export const templateLabel = (ref: TemplateRef) =>
  ref.suffix ? copy.alternate(copy.names[ref.key], ref.suffix) : copy.names[ref.key]

/** Shopify's template switcher: search, every template kind grouped with its alternates, and Create. */
export default function TemplatePicker({
  value,
  alternates,
  loading,
  onChange,
  onCreate,
}: TemplatePickerProps) {
  // Hooks
  const [open, setOpen] = useState(false)

  // Event handlers
  const handlePick = (ref: TemplateRef) => {
    onChange(ref)
    setOpen(false)
  }
  const handleCreate = (kind: AlternateKind) => {
    onCreate(kind)
    setOpen(false)
  }

  // Render logic
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-64 justify-between rounded-lg text-[0.8125rem] font-medium"
            aria-label={copy.label}
          >
            <span className="flex min-w-0 items-center gap-2">
              {loading ? (
                <Loader2Icon className="size-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Home className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="truncate">{templateLabel(value)}</span>
            </span>
            <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="center" className="w-[26rem] gap-0 p-0">
        <TemplateList
          value={value}
          alternates={alternates}
          onPick={handlePick}
          onCreate={handleCreate}
        />
      </PopoverContent>
    </Popover>
  )
}
