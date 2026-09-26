'use client'

import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Puck } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE, locateSection } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import PanelHeader from './panel-header'
import SectionIcon from './section-icon'

type SectionInspectorProps = {
  /** Shown instead of the empty state, so the pane is never just blank text. */
  settings: ReactNode
}

const copy = customizeContent.inspector
const groups = customizeContent.groups
const panels = customizeContent.panels

const zoneLabel = (zone: string) => {
  if (zone === HEADER_ZONE) return groups.header
  if (zone === FOOTER_ZONE) return groups.footer
  return groups.template
}

/** The right pane: the selected section's settings, drawn by Puck's own field
 * renderer, under a header naming the section and the group it sits in — or,
 * with nothing selected, the theme settings, so there's always something to
 * edit here. */
export default function SectionInspector({ settings }: SectionInspectorProps) {
  // Hooks
  const selected = useCustomizePuck((s) => s.selectedItem)
  const components = useCustomizePuck((s) => s.config.components)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const reducedMotion = useReducedMotion()

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
  const label = component?.label ?? selected.type
  const hasFields = Object.keys(component?.fields ?? {}).length > 0
  const located = locateSection(data, selected.props.id)
  const crumb = located ? zoneLabel(located.zone) : null

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
        icon={<SectionIcon type={selected.type} className="size-4" />}
        title={label}
        hint={crumb}
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => dispatch({ type: 'setUi', ui: { itemSelector: null } })}
            aria-label={panels.deselect}
            title={panels.deselect}
          >
            <X aria-hidden />
          </Button>
        }
      />
      {hasFields ? (
        <div className="min-h-0 flex-1 overflow-y-auto [&>form]:flex [&>form]:flex-col [&>form]:gap-5 [&>form]:px-4 [&>form]:pt-4 [&>form]:pb-6">
          <Puck.Fields wrapFields={false} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <SectionIcon type={selected.type} className="size-5" />
          </span>
          <p className="text-[0.8125rem] text-muted-foreground">{copy.emptyFields}</p>
        </div>
      )}
    </motion.section>
  )
}
