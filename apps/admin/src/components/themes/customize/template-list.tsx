'use client'

import {
  ALTERNATE_KINDS,
  type AlternateKind,
  TEMPLATE_KINDS,
  type TemplateKind,
  templateName,
} from '@commerce/core/theme'
import { editorGlyphs, Home, type IconComponent, Plus } from '@commerce/ui/icons'
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

/**
 * Figma's page list (381:6609 in the Pages panel, 369:125349 in the top bar's popover): a 40px
 * search, uppercase "PAGES" / "TEMPLATES" labels, 35px rows with the kind's glyph, the open one
 * tinted rather than ticked. The kinds' own headings stay for screen readers only.
 */
const LOOK =
  'bg-transparent **:data-[slot=command-input-wrapper]:p-0 **:data-[slot=input-group]:h-10! **:data-[slot=input-group]:rounded-[0.625rem]! **:data-[slot=command-group]:p-0 **:[[cmdk-group-heading]]:sr-only'
const ITEM =
  'min-h-[2.1875rem] rounded-lg px-2 text-[0.8125rem] data-[checked=true]:bg-primary-soft data-[checked=true]:font-medium data-[checked=true]:text-primary [&>svg:last-child]:hidden'

/** Each kind's glyph, from the editor set (Phosphor regular). */
const KIND_ICONS: Record<TemplateKind, IconComponent> = {
  home: Home,
  product: editorGlyphs.package,
  collection: editorGlyphs.grid,
  page: editorGlyphs.page,
  blog: editorGlyphs.news,
  article: editorGlyphs.text,
  cart: editorGlyphs.cart,
  search: editorGlyphs.search,
  not_found: editorGlyphs.notFound,
}

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
 * Every page and template of the theme to jump between: a search, the pages (home, cart,
 * search, 404) and the templates with their alternates, each kind with "Create template". Each
 * alternate shows how many resources use it and has a small manager (rename, duplicate,
 * delete); the default template has none. The top bar's template picker and the Pages panel
 * share it, and each renders `TemplateManagerDialogs` for its manager; the picker's popover adds
 * "New page" under the pages and the keys at the foot.
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
  const panels = useCopy(customizeContent.panels)

  // Event handlers
  const handleAction = (kind: AlternateKind, suffix: string, action: AlternateAction) => {
    onAction?.()
    if (action === 'duplicate') void manager.duplicate(kind, suffix)
    else manager.setPending({ action, kind, suffix })
  }

  // Render logic
  return (
    <Command className={cn(LOOK, fill ? 'min-h-0 flex-1 p-0 px-4' : 'p-2')}>
      <CommandInput placeholder={copy.search} aria-label={copy.search} />
      <CommandList className={cn(fill ? 'max-h-none flex-1 pb-4' : 'max-h-[27rem]')}>
        <CommandEmpty>{copy.empty}</CommandEmpty>
        {['pages', 'templates'].map((section) => (
          <div key={section}>
            <p
              className={cn(
                'pt-4 pb-2 text-xs leading-[1.0625rem] font-medium tracking-[0.04em] text-muted-foreground uppercase',
                fill ? 'px-0' : 'px-2',
              )}
            >
              {section === 'pages' ? groups.pages : groups.templates}
            </p>
            {TEMPLATE_KINDS.filter((key) => isAlternateKind(key) === (section === 'templates')).map(
              (key) => {
                const own = alternates.filter((a) => a.template === key && a.suffix)
                const Icon = KIND_ICONS[key]
                return (
                  <CommandGroup key={key} heading={copy.names[key]}>
                    <CommandItem
                      value={`${copy.names[key]} ${own.length > 0 ? copy.default : ''}`}
                      data-checked={value.key === key && value.suffix === '' ? 'true' : undefined}
                      onSelect={() => onPick({ key, suffix: '' })}
                      className={ITEM}
                    >
                      <Icon aria-hidden weight="regular" />
                      <span className="min-w-0 flex-1 truncate">{copy.names[key]}</span>
                      {isAlternateKind(key) ? (
                        <span className={`shrink-0 ${CHROME_META}`}>{copy.default}</span>
                      ) : null}
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
                              className={`${ITEM} pl-8`}
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
                        className={`${ITEM} pl-8 text-muted-foreground`}
                      >
                        <Plus aria-hidden />
                        {copy.create}
                      </CommandItem>
                    ) : null}
                  </CommandGroup>
                )
              },
            )}
            {section === 'pages' && !fill ? (
              // cmdk sorts items within their group, so this one has its own.
              <CommandGroup>
                <CommandItem
                  value={panels.newPage}
                  onSelect={() => onCreate('page')}
                  className={`${ITEM} text-muted-foreground`}
                >
                  <Plus aria-hidden />
                  {panels.newPage}
                </CommandItem>
              </CommandGroup>
            ) : null}
          </div>
        ))}
      </CommandList>
      {fill ? null : (
        <p className="flex gap-3 border-t border-border px-2 pt-2 text-xs leading-[1.0625rem] text-muted-foreground">
          <span>{copy.keys.move}</span>
          <span>{copy.keys.open}</span>
          <span>{copy.keys.close}</span>
        </p>
      )}
    </Command>
  )
}
