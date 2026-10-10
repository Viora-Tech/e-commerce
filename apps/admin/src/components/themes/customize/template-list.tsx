'use client'

import {
  ALTERNATE_KINDS,
  TEMPLATE_KINDS,
  type TemplateKind,
  templateName,
} from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@commerce/ui/shadcn/command'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import type { TemplateRef } from './template-picker'

type AlternateKind = (typeof ALTERNATE_KINDS)[number]

type TemplateListProps = {
  value: TemplateRef
  /** Stored alternates of this theme, by kind. */
  alternates: { template: string; suffix: string }[]
  onPick: (ref: TemplateRef) => void
  /** Kind is the group "Create template" was clicked in, when it supports alternates. */
  onCreate: (kind: AlternateKind) => void
  /** Fills its panel (the Pages rail panel) instead of sizing to a popover. */
  fill?: boolean | undefined
}

const copy = customizeContent.templates

const isAlternateKind = (key: TemplateKind): key is AlternateKind =>
  (ALTERNATE_KINDS as readonly string[]).includes(key)

/**
 * Every page and template of the theme to jump between: a search, the pages (home, product,
 * collection...) and the templates with their alternates, each kind with "Create template".
 * The top bar's template picker and the Pages panel share it.
 */
export default function TemplateList({
  value,
  alternates,
  onPick,
  onCreate,
  fill,
}: TemplateListProps) {
  // Hooks
  const groups = useCopy(customizeContent.groups)

  return (
    <Command className={cn(fill && 'h-full bg-transparent')}>
      <CommandInput placeholder={copy.search} aria-label={copy.search} />
      <CommandList className={cn(fill && 'max-h-none flex-1')}>
        <CommandEmpty>{copy.empty}</CommandEmpty>
        {['pages', 'templates'].map((section) => (
          <div key={section}>
            <p className="px-3 pt-2 pb-1 text-caption font-semibold text-foreground">
              {section === 'pages' ? groups.pages : groups.templates}
            </p>
            {TEMPLATE_KINDS.filter((key) => isAlternateKind(key) === (section === 'templates')).map(
              (key) => {
                const own = alternates.filter((a) => a.template === key && a.suffix)
                const currentIsDefault = value.key === key && value.suffix === ''
                return (
                  <CommandGroup key={key} heading={copy.names[key]}>
                    <CommandItem
                      value={`${copy.names[key]} ${own.length > 0 ? copy.default : ''}`}
                      data-checked={currentIsDefault ? 'true' : undefined}
                      onSelect={() => onPick({ key, suffix: '' })}
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
                        onSelect={() => onPick({ key, suffix: a.suffix })}
                      >
                        {a.suffix}
                      </CommandItem>
                    ))}
                    {isAlternateKind(key) ? (
                      <CommandItem
                        value={`${copy.names[key]} ${copy.create}`}
                        onSelect={() => onCreate(key)}
                      >
                        <Plus aria-hidden />
                        {copy.create}
                      </CommandItem>
                    ) : null}
                  </CommandGroup>
                )
              },
            )}
          </div>
        ))}
      </CommandList>
    </Command>
  )
}
