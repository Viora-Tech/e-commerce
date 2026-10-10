'use client'

import type { AlternateKind, TemplateKind } from '@commerce/core/theme'
import { ChevronDown, Home, Loader2Icon } from '@commerce/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { type TemplateChange, useTemplateManager } from '@/lib/use-template-manager'
import TemplateList from './template-list'
import TemplateManagerDialogs from './template-manager-dialogs'

export type TemplateRef = { key: TemplateKind; suffix: string }

type TemplatePickerProps = {
  themeId: string
  value: TemplateRef
  /** Stored alternates of this theme, by kind. */
  alternates: { template: string; suffix: string }[]
  /** A template switch is in flight; the trigger shows a spinner instead of blocking. */
  loading?: boolean
  onChange: (ref: TemplateRef) => void
  /** Kind is the group "Create template" was clicked in, when it supports alternates. */
  onCreate: (kind: AlternateKind) => void
  /** An alternate was renamed, duplicated or deleted from the picker's manager. */
  onManaged: (change: TemplateChange) => void
}

const copy = customizeContent.templates

export const templateLabel = (ref: TemplateRef) =>
  ref.suffix ? copy.alternate(copy.names[ref.key], ref.suffix) : copy.names[ref.key]

/**
 * Shopify's template switcher in the top bar (Figma 369:4855, the page switcher): `TemplateList` (search, every template kind
 * grouped with its alternates, usage counts, the alternate manager, Create) in a popover. The
 * manager's dialogs sit outside the popover, which closes when one opens.
 */
export default function TemplatePicker({
  themeId,
  value,
  alternates,
  loading,
  onChange,
  onCreate,
  onManaged,
}: TemplatePickerProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const manager = useTemplateManager({ themeId, alternates, onChanged: onManaged })

  // Event handlers
  const handleOpen = (next: boolean) => {
    setOpen(next)
    if (next) manager.refresh()
  }
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
    <>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={copy.label}
              className="flex h-[2.375rem] w-60 items-center gap-2 rounded-[0.625rem] bg-muted pr-2.5 pl-3 text-left text-sm leading-5 font-semibold text-foreground transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none motion-reduce:transition-none data-[popup-open]:bg-accent"
            >
              {loading || manager.busy ? (
                <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Home className="size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{templateLabel(value)}</span>
              <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          }
        />
        <PopoverContent align="center" className="w-[26rem] gap-0 p-0">
          <TemplateList
            value={value}
            alternates={alternates}
            manager={manager}
            onPick={handlePick}
            onCreate={handleCreate}
            onAction={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
      <TemplateManagerDialogs manager={manager} />
    </>
  )
}
