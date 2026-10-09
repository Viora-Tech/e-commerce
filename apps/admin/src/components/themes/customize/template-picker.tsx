'use client'

import {
  ALTERNATE_KINDS,
  TEMPLATE_KINDS,
  type TemplateKind,
  templateName,
} from '@commerce/core/theme'
import { ChevronDown, Home, Loader2Icon, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@commerce/ui/shadcn/command'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'

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

const isAlternateKind = (key: TemplateKind): key is AlternateKind =>
  (ALTERNATE_KINDS as readonly string[]).includes(key)

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

  const groups = useCopy(customizeContent.groups)

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
        <Command>
          <CommandInput placeholder={copy.search} aria-label={copy.search} />
          <CommandList>
            <CommandEmpty>{copy.empty}</CommandEmpty>
            {['pages', 'templates'].map((section) => (
              <div key={section}>
                <p className="px-3 pt-2 pb-1 text-caption font-semibold text-foreground">
                  {section === 'pages' ? groups.pages : groups.templates}
                </p>
                {TEMPLATE_KINDS.filter(
                  (key) => isAlternateKind(key) === (section === 'templates'),
                ).map((key) => {
                  const own = alternates.filter((a) => a.template === key && a.suffix)
                  const currentIsDefault = value.key === key && value.suffix === ''
                  return (
                    <CommandGroup key={key} heading={copy.names[key]}>
                      <CommandItem
                        value={`${copy.names[key]} ${own.length > 0 ? copy.default : ''}`}
                        data-checked={currentIsDefault ? 'true' : undefined}
                        onSelect={() => handlePick({ key, suffix: '' })}
                      >
                        {own.length > 0 ? copy.default : copy.names[key]}
                      </CommandItem>
                      {own.map((a) => (
                        <CommandItem
                          key={templateName(key, a.suffix)}
                          value={`${copy.names[key]} ${a.suffix}`}
                          data-checked={
                            value.key === key && value.suffix === a.suffix ? 'true' : undefined
                          }
                          onSelect={() => handlePick({ key, suffix: a.suffix })}
                        >
                          {a.suffix}
                        </CommandItem>
                      ))}
                      {isAlternateKind(key) ? (
                        <CommandItem
                          value={`${copy.names[key]} ${copy.create}`}
                          onSelect={() => handleCreate(key)}
                        >
                          <Plus aria-hidden />
                          {copy.create}
                        </CommandItem>
                      ) : null}
                    </CommandGroup>
                  )
                })}
              </div>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
