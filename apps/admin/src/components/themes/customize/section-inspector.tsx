'use client'

import { X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Puck } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from '@/lib/customize-doc'
import { isElementStyleField, isSectionSettingsField } from '@/lib/customize-field-shape'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { findBlock, locateBlock, slotOwner } from '@/lib/customize-slots'
import PanelHeader from './panel-header'
import SectionIcon from './section-icon'

type SectionInspectorProps = {
  /** Shown instead of the empty state, so the pane is never just blank text. */
  settings: ReactNode
}

type Tab = 'basic' | 'advanced'

const TABS: Tab[] = ['basic', 'advanced']

/**
 * Puck draws every field as a child of one form; the shared Layout / Spacing / Style / Advanced
 * groups are the one field marked `data-advanced`. Basic hides that group, Advanced hides every
 * other field.
 */
const TAB_CLASS: Record<Tab, string> = {
  basic: '[&_[data-advanced]]:hidden',
  advanced: '[&_form>*:not(:has([data-advanced]))]:hidden',
}

/** The group a zone belongs to, in the member's language. */
function zoneLabel(groups: Record<'header' | 'template' | 'footer', string>, zone: string): string {
  if (zone === HEADER_ZONE) return groups.header
  if (zone === FOOTER_ZONE) return groups.footer
  return groups.template
}

/** The right pane: the selected section's settings, drawn by Puck's own field
 * renderer, under a header naming the section and the group it sits in, with Basic (the
 * section's own fields) and Advanced (layout, spacing, style) tabs — or, with nothing
 * selected, the theme settings, so there's always something to edit here. */
export default function SectionInspector({ settings }: SectionInspectorProps) {
  // Hooks
  const copy = useCopy(customizeContent.inspector)
  const groups = useCopy(customizeContent.groups)
  const panels = useCopy(customizeContent.panels)
  const selected = useCustomizePuck((s) => s.selectedItem)
  const components = useCustomizePuck((s) => s.config.components)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const reducedMotion = useReducedMotion()
  const [tab, setTab] = useState<Tab>('basic')

  // Early returns
  if (!selected) {
    return (
      <section aria-label={panels.theme} className="flex min-h-0 flex-1 flex-col">
        <PanelHeader title={panels.theme} hint={panels.themeHint} />
        <div className="min-h-0 flex-1 overflow-y-auto">{settings}</div>
      </section>
    )
  }

  // Render logic
  const component = components[selected.type]
  // A renamed section (or an imported one, named after its theme schema) shows its own name.
  const label = sectionName(selected, component?.label ?? selected.type)
  const fields = Object.entries(component?.fields ?? {})
  const hasFields = fields.length > 0
  const hasAdvanced = fields.some(
    ([name, field]) =>
      isSectionSettingsField(field as never, name) || isElementStyleField(field as never, name),
  )
  const active: Tab = hasAdvanced ? tab : 'basic'
  const located = locateBlock(data, selected.props.id)
  // A nested block names its container ("In Promo strip"); a section its group.
  const owner = located ? slotOwner(data, located.zone) : null
  const parent = owner ? findBlock(data, owner.id) : null
  const crumb = parent
    ? copy.inside(sectionName(parent, components[parent.type]?.label ?? parent.type))
    : located
      ? zoneLabel(groups, located.zone)
      : null

  return (
    <motion.section
      key={selected.props.id}
      initial={reducedMotion ? false : { opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      className="flex min-h-0 flex-1 flex-col"
      aria-label={copy.label}
    >
      <PanelHeader
        icon={<SectionIcon type={selected.type} tile="md" />}
        title={label}
        hint={crumb}
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => dispatch({ type: 'setUi', ui: { itemSelector: null } })}
            aria-label={panels.deselect}
            title={panels.deselect}
          >
            <X aria-hidden className="size-4" />
          </Button>
        }
      />
      {hasAdvanced ? (
        <div className="flex flex-col gap-1.5 border-b border-border px-4 py-3">
          <div
            role="tablist"
            aria-label={copy.label}
            className="grid grid-cols-2 gap-0.5 rounded-lg border border-hairline bg-chip-neutral p-0.5"
          >
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active === id}
                onClick={() => setTab(id)}
                className={cn(
                  'h-7 rounded-md text-caption font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none motion-reduce:transition-none',
                  active === id && 'bg-card text-foreground shadow-sm ring-1 ring-border',
                )}
              >
                {copy.tabs[id]}
              </button>
            ))}
          </div>
          <p className="text-[0.6875rem] leading-4 text-muted-foreground">
            {copy.tabHints[active]}
          </p>
        </div>
      ) : null}
      {hasFields ? (
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto [&>form]:flex [&>form]:flex-col [&>form]:gap-4 [&>form]:px-4 [&>form]:pt-4 [&>form]:pb-6',
            hasAdvanced && TAB_CLASS[active],
          )}
        >
          <Puck.Fields wrapFields={false} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <SectionIcon type={selected.type} tile="md" />
          <p className="text-[0.8125rem] text-muted-foreground">{copy.emptyFields}</p>
        </div>
      )}
    </motion.section>
  )
}
