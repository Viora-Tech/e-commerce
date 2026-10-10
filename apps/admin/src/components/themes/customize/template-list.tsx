'use client'

import {
  ALTERNATE_KINDS,
  type AlternateKind,
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
import { CHROME_META } from '@/lib/customize-chrome'
import type { useTemplateManager } from '@/lib/use-template-manager'
import TemplateAlternateMenu, { type AlternateAction } from './template-alternate-menu'
import type { TemplateRef } from './template-picker'

type TemplateListProps = {
  value: TemplateRef
  /** Stored alternates of this theme, by kind. */
  alternates: { template: string; suffix: string }[]
  /** The host's template manager: usage counts and rename / duplicate / delete. */
  manager: ReturnType<typeof useTemplateManager>
  onPick: (ref: TemplateRef) => void
  /** Kind is the group "Create template" was clicked in, when it supports alternates. */
  onCreate: (kind: AlternateKind) => void
  /** Before an alternate's action runs (the picker closes its popover). */
  onAction?: (() => void) | undefined
  /** Fills its panel (the Pages rail panel) instead of sizing to a popover. */
  fill?: boolean | undefined
}

const copy = customizeContent.templates

const isAlternateKind = (key: TemplateKind): key is AlternateKind =>
  (ALTERNATE_KINDS as readonly string[]).includes(key)

/** "Used by 2 products", or nothing when no resource uses the alternate. */
export function usedLabel(
  manager: ReturnType<typeof useTemplateManager>,
  kind: AlternateKind,
  suffix: string,
): string {
  const n = manager.usedBy(kind, suffix)
  return n > 0 ? copy.usedBy(n, kind) : ''
}

/**
 * Every page and template of the theme to jump between: a search, the pages (home, product,
 * collection...) and the templates with their alternates, each kind with "Create template".
 * Each alternate shows how many resources use it and has a small manager (rename, duplicate,
 * delete); the default template has none. The top bar's template picker and the Pages panel
 * share it, and each renders `TemplateManagerDialogs` for its manager.
 */
export default function TemplateList({
  value,
  alternates,
  manager,
  onPick,
  onCreate,
  onAction,
  fill,
}: TemplateListProps) {
  // Hooks
  const groups = useCopy(customizeContent.groups)

  // Event handlers
  const handleAction = (kind: AlternateKind, suffix: string, action: AlternateAction) => {
    onAction?.()
    if (action === 'duplicate') void manager.duplicate(kind, suffix)
    else manager.setPending({ action, kind, suffix })
  }

  // Render logic
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
                    {isAlternateKind(key)
                      ? own.map((a) => {
                          const used = usedLabel(manager, key, a.suffix)
                          return (
                            <CommandItem
                              key={templateName(key, a.suffix)}
                              value={`${copy.names[key]} ${a.suffix}`}
                              data-checked={
                                value.key === key && value.suffix === a.suffix ? 'true' : undefined
                              }
                              onSelect={() => onPick({ key, suffix: a.suffix })}
                            >
                              <span className="min-w-0 truncate">{a.suffix}</span>
                              {used ? (
                                <span className={`shrink-0 ${CHROME_META}`}>{used}</span>
                              ) : null}
                              <TemplateAlternateMenu
                                name={copy.alternate(copy.names[key], a.suffix)}
                                onAction={(action) => handleAction(key, a.suffix, action)}
                              />
                            </CommandItem>
                          )
                        })
                      : null}
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
