'use client'

import { SINGLE_SECTIONS } from '@commerce/core/theme'
import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Puck } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { deleteWithCollapse } from '@/lib/customize-canvas-motion'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { isElementStyleField, isSectionSettingsField } from '@/lib/customize-field-shape'
import { sectionName } from '@/lib/customize-insert'
import { InspectorTabContext } from '@/lib/customize-inspector-tab'
import { useCustomizePuck } from '@/lib/customize-puck'
import { sectionHandle } from '@/lib/customize-section-kinds'
import { locateBlock } from '@/lib/customize-slots'
import ImportedSectionNote from './imported-section-note'
import InspectorBreadcrumb from './inspector-breadcrumb'
import InspectorEmpty from './inspector-empty'
import SectionIcon from './section-icon'
import SegmentedTabs from './segmented-tabs'

type Tab = 'basic' | 'advanced'

const TABS: Tab[] = ['basic', 'advanced']

/** The right pane (Figma "Inspector", 381:6210): the selected section's name with a delete
 * button, Basic (the section's own fields, in a Content card) and Advanced (layout, spacing,
 * style cards, under where the block sits) on a segmented switch with a one-line hint, all
 * drawn by Puck's own field renderer on one 16px-gutter column. With nothing selected it says
 * how to pick one (`InspectorEmpty`, Figma 369:129005); theme settings live only in the rail's
 * Theme tab. Esc deselects (`CustomizeHotkeys`). */
export default function SectionInspector() {
  // Hooks
  const copy = useCopy(customizeContent.inspector)
  const selected = useCustomizePuck((s) => s.selectedItem)
  const components = useCustomizePuck((s) => s.config.components)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const reducedMotion = useReducedMotion()
  const [tab, setTab] = useState<Tab>('basic')

  // Event handlers
  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    if (!selected) return
    const located = locateBlock(data, selected.props.id)
    if (!located) return
    const el =
      document
        .querySelector<HTMLIFrameElement>('iframe')
        ?.contentDocument?.querySelector<HTMLElement>(
          `[data-puck-component="${selected.props.id}"]`,
        ) ?? null
    e.currentTarget.blur()
    deleteWithCollapse(dispatch, located, el, reducedMotion === true)
  }

  // Early returns
  if (!selected) return <InspectorEmpty />

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
  // An imported Shopify section names its file in the theme (`props.sectionType`).
  const liquidType =
    selected.type === 'LiquidSection' && typeof selected.props.sectionType === 'string'
      ? selected.props.sectionType
      : null

  return (
    <motion.section
      key={selected.props.id}
      initial={reducedMotion ? false : { opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain p-4"
      aria-label={copy.label}
    >
      <header className="flex shrink-0 items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base leading-[1.4375rem] font-semibold text-foreground">
          {label}
        </h2>
        {SINGLE_SECTIONS.has(selected.type) ? null : (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-danger"
            onClick={handleRemove}
            aria-label={copy.remove(label)}
            title={copy.remove(label)}
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        )}
      </header>
      {liquidType ? <ImportedSectionNote sectionType={liquidType} place="top" /> : null}
      {hasAdvanced ? (
        <>
          <SegmentedTabs
            tabs={TABS}
            value={active}
            onChange={setTab}
            label={copy.label}
            size="md"
            className="shrink-0"
            render={(id) => copy.tabs[id]}
          />
          <p className="text-xs leading-[1.0625rem] text-muted-foreground">
            {copy.tabHints[active]}
          </p>
        </>
      ) : null}
      {active === 'advanced' ? (
        <p className="flex h-7 shrink-0 items-center text-xs leading-[1.0625rem]">
          <InspectorBreadcrumb blockId={selected.props.id} />
        </p>
      ) : null}
      {hasFields ? (
        <div className="[&>form]:flex [&>form]:flex-col [&>form]:gap-3.5">
          <InspectorTabContext.Provider value={hasAdvanced ? active : 'all'}>
            <Puck.Fields wrapFields={false} />
          </InspectorTabContext.Provider>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <SectionIcon type={selected.type} handle={sectionHandle(selected)} tile="md" />
          <p className="text-[0.8125rem] text-muted-foreground">{copy.emptyFields}</p>
        </div>
      )}
      {liquidType ? <ImportedSectionNote sectionType={liquidType} place="bottom" /> : null}
    </motion.section>
  )
}
