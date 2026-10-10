'use client'

import {
  ALTERNATE_KINDS,
  type AlternateKind,
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
import { CHROME_META } from '@/lib/customize-chrome'
import { type TemplateChange, useTemplateManager } from '@/lib/use-template-manager'
import DeleteTemplateDialog from './delete-template-dialog'
import RenameTemplateDialog from './rename-template-dialog'
import TemplateAlternateMenu, { type AlternateAction } from './template-alternate-menu'

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

const isAlternateKind = (key: TemplateKind): key is AlternateKind =>
  (ALTERNATE_KINDS as readonly string[]).includes(key)

export const templateLabel = (ref: TemplateRef) =>
  ref.suffix ? copy.alternate(copy.names[ref.key], ref.suffix) : copy.names[ref.key]

/**
 * Shopify's template switcher: search, every template kind grouped with its alternates, and
 * Create. Each alternate shows how many resources use it and has a small manager (rename,
 * duplicate, delete); the default template has none.
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
  const groups = useCopy(customizeContent.groups)
  const manager = useTemplateManager({ themeId, alternates, onChanged: onManaged })

  // Helpers
  const used = (kind: AlternateKind, suffix: string) => {
    const n = manager.usedBy(kind, suffix)
    return n > 0 ? copy.usedBy(n, kind) : ''
  }

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
  const handleAction = (kind: AlternateKind, suffix: string, action: AlternateAction) => {
    setOpen(false)
    if (action === 'duplicate') void manager.duplicate(kind, suffix)
    else manager.setPending({ action, kind, suffix })
  }

  // Render logic
  const pending = manager.pending

  return (
    <>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="w-64 justify-between rounded-lg text-[0.8125rem] font-medium"
              aria-label={copy.label}
            >
              <span className="flex min-w-0 items-center gap-2">
                {loading || manager.busy ? (
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
                        {isAlternateKind(key)
                          ? own.map((a) => (
                              <CommandItem
                                key={templateName(key, a.suffix)}
                                value={`${copy.names[key]} ${a.suffix}`}
                                data-checked={
                                  value.key === key && value.suffix === a.suffix
                                    ? 'true'
                                    : undefined
                                }
                                onSelect={() => handlePick({ key, suffix: a.suffix })}
                              >
                                <span className="min-w-0 truncate">{a.suffix}</span>
                                {used(key, a.suffix) ? (
                                  <span className={`shrink-0 ${CHROME_META}`}>
                                    {used(key, a.suffix)}
                                  </span>
                                ) : null}
                                <TemplateAlternateMenu
                                  name={copy.alternate(copy.names[key], a.suffix)}
                                  onAction={(action) => handleAction(key, a.suffix, action)}
                                />
                              </CommandItem>
                            ))
                          : null}
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
      {pending?.action === 'rename' ? (
        <RenameTemplateDialog
          key={`${pending.kind}.${pending.suffix}`}
          suffix={pending.suffix}
          used={used(pending.kind, pending.suffix)}
          busy={manager.busy}
          onCancel={() => manager.setPending(null)}
          onRename={manager.rename}
        />
      ) : null}
      {pending?.action === 'delete' ? (
        <DeleteTemplateDialog
          name={copy.alternate(copy.names[pending.kind], pending.suffix)}
          used={used(pending.kind, pending.suffix)}
          onCancel={() => manager.setPending(null)}
          onConfirm={manager.remove}
        />
      ) : null}
    </>
  )
}
