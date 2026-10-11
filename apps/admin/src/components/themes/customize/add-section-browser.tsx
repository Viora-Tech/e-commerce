'use client'

import { presetProps, presetsFor } from '@commerce/blocks/section-presets'
import type { CustomSection, SectionGroup, TemplateSection } from '@commerce/core/theme'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { Drawer } from '@puckeditor/core'
import { useState } from 'react'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import { insertActions } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { insertCopyActions } from '@/lib/customize-slots'
import { useImportedTheme } from '@/lib/customize-theme-context'
import { importedSections, matchesImported, newImportedSection } from '@/lib/imported-sections'
import AppsTab from './add-section-apps-tab'
import AddSectionGroup from './add-section-group'
import ImportedTab from './add-section-imported-tab'
import MySectionsTab from './add-section-my-tab'
import SectionsTab, { type AddKind } from './add-section-sections-tab'
import AddSectionStyles from './add-section-styles'

type AddSectionBrowserProps = {
  /** Puck zone the section lands in when added by click, or dropped without crossing to another zone. */
  zone: string
  /** Header and footer groups only take their own sections; the persistent Add panel passes null. */
  group: SectionGroup | null
  /** Where a clicked section goes in `zone` (0 = first); `count` puts it at the end. */
  index: number
  /** How many sections `zone` holds now, to keep `index` in range. */
  count: number
  /** Closes the popover this sits in; the persistent Add panel leaves it out. */
  onAdd?: () => void
  /**
   * The persistent rail panel (`AddSectionPanel`) sits in a fixed-height column
   * and wants its list to fill that height with its own internal scroll. The
   * per-group popover (`AddSectionPopover`) floats over the canvas and wants a
   * capped height instead, so it never grows taller than the viewport.
   */
  fill?: boolean
}

const copy = customizeContent.addSection

/** Groups that are not library categories, folded by the same switch. */
const MINE = 'mine'
const APPS = 'apps'
const IMPORTED = 'imported'

/**
 * The Add panel (Figma 369:4899): a "Sections | Blocks" switch, a search, then folding groups of
 * picture tiles. Sections holds the section library and the store's saved sections (My
 * sections); Blocks holds the layout and element blocks and the installed apps' blocks. A
 * section with styles asks for one first (`AddSectionStyles`). Shared by the per-group popover
 * (`AddSectionPopover`) and the persistent Add rail panel.
 */
export default function AddSectionBrowser({
  zone,
  group,
  index,
  count,
  onAdd,
  fill,
}: AddSectionBrowserProps) {
  // Hooks
  const [kind, setKind] = useState<AddKind>('sections')
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  /** A section with styles that was clicked: its style step is showing. */
  const [styling, setStyling] = useState<string | null>(null)
  /** Groups the merchant folded, by title (or `mine` / `apps`). */
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set())
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const components = useCustomizePuck((s) => s.config.components)
  const importedTheme = useImportedTheme()
  const importedCopy = useCopy(themeImportContent.addPanel)

  // Helpers
  const labelOf = (type: string) => components[type]?.label ?? type

  /** A group is open unless folded; a search opens every group so its matches show. */
  const isOpen = (title: string) => query.trim() !== '' || !closed.has(title)

  const finish = () => {
    setQuery('')
    setStyling(null)
    onAdd?.()
  }

  // Event handlers
  /** A section with styles asks for one first; any other is added with its defaults. */
  const handleAdd = (type: string) => {
    if (presetsFor(type).length > 0) {
      setStyling(type)
      setHovered(null)
      return
    }
    for (const action of insertActions({ zone, index }, type, count)) dispatch(action)
    finish()
  }

  const handleAddStyled = (presetId: string) => {
    if (!styling) return
    const defaults = (components[styling]?.defaultProps ?? {}) as Record<string, unknown>
    const block = {
      type: styling,
      props: { ...presetProps(styling, presetId, defaults), id: styling },
    } as TemplateSection
    for (const action of insertCopyActions({ zone, index }, block, count)) dispatch(action)
    finish()
  }

  const handleAddCopy = (section: CustomSection) => {
    const block = section.block as TemplateSection
    for (const action of insertCopyActions({ zone, index }, block, count)) dispatch(action)
    toast.success(customizeContent.mySections.added(section.name))
    finish()
  }

  /** A section of the imported Shopify theme, started from its first preset. */
  const handleAddImported = (type: string, name: string) => {
    const block = importedTheme ? newImportedSection(importedTheme, type) : null
    if (!block) return
    for (const action of insertCopyActions({ zone, index }, block, count)) dispatch(action)
    toast.success(importedCopy.added(name))
    finish()
  }

  const handleToggle = (title: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })

  // Early returns
  if (styling) {
    return (
      <div
        className={cn(
          'relative flex flex-1 flex-col gap-2',
          fill ? 'min-h-0' : 'max-h-[28rem] p-2',
        )}
      >
        <AddSectionStyles
          type={styling}
          label={labelOf(styling)}
          presets={presetsFor(styling)}
          onPick={handleAddStyled}
          onBack={() => setStyling(null)}
        />
      </div>
    )
  }

  // Render logic
  // The store's imported theme: its own sections, only while the Sections switch is on and the
  // panel is not scoped to a header or footer group. The same search filters them.
  const needle = query.trim().toLowerCase()
  const imported =
    importedTheme && kind === 'sections' && !group
      ? importedSections(importedTheme).filter((s) => matchesImported(s, needle))
      : []
  const listClass = fill
    ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [&>div]:gap-4'
    : 'max-h-96 overflow-y-auto overscroll-contain [&>div]:gap-4'

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clears the hover preview only; every item inside is its own focusable button.
    <div
      className={cn('relative flex flex-1 flex-col gap-4', fill ? 'min-h-0' : 'p-3')}
      onMouseLeave={() => setHovered(null)}
    >
      <KindSwitch value={kind} onChange={setKind} />
      {/* Figma 369:4908: a plain field, no magnifier. */}
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={copy.search}
        aria-label={copy.search}
        className="h-10 rounded-[0.625rem] px-3 text-sm"
      />
      {/* The scroller sits outside Puck's Drawer: the Drawer is a plain flex column with no
          height of its own, so a list inside it never got a height to scroll within. */}
      <div className={listClass}>
        <Drawer>
          {imported.length > 0 ? (
            <AddSectionGroup
              title={importedCopy.title}
              open={isOpen(IMPORTED)}
              onToggle={() => handleToggle(IMPORTED)}
            >
              <ImportedTab sections={imported} onAdd={handleAddImported} />
            </AddSectionGroup>
          ) : null}
          <SectionsTab
            group={group}
            kind={kind}
            query={query}
            hovered={hovered}
            closed={closed}
            onToggle={handleToggle}
            onHover={setHovered}
            labelOf={labelOf}
            onAdd={handleAdd}
            othersMatch={imported.length > 0}
          />
          {kind === 'sections' && !group ? (
            <AddSectionGroup
              title={copy.tabs.mine}
              open={isOpen(MINE)}
              onToggle={() => handleToggle(MINE)}
            >
              <MySectionsTab query={query} onAdd={handleAddCopy} />
            </AddSectionGroup>
          ) : null}
          {kind === 'blocks' ? (
            <AddSectionGroup
              title={copy.tabs.apps}
              open={isOpen(APPS)}
              onToggle={() => handleToggle(APPS)}
            >
              <AppsTab
                query={query}
                hovered={hovered}
                onHover={setHovered}
                labelOf={labelOf}
                onAdd={handleAdd}
              />
            </AddSectionGroup>
          ) : null}
        </Drawer>
      </div>
    </div>
  )
}

/** Figma's "Sections | Blocks" segmented switch (369:4903): a muted track, the chosen one raised. */
function KindSwitch({ value, onChange }: { value: AddKind; onChange: (kind: AddKind) => void }) {
  // Render logic
  return (
    <div
      role="tablist"
      aria-label={copy.kinds.label}
      className="flex gap-0.5 rounded-lg bg-muted p-0.5"
    >
      {(['sections', 'blocks'] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={cn(
            'flex h-[2.125rem] flex-1 items-center justify-center rounded-md text-xs leading-[1.0625rem] font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-150 hover:text-foreground motion-reduce:transition-none',
            CHROME_FOCUS,
            value === k && 'bg-card text-foreground shadow-card',
          )}
        >
          {copy.kinds[k]}
        </button>
      ))}
    </div>
  )
}
