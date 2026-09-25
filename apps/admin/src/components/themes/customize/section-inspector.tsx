'use client'

import { Puck } from '@puckeditor/core'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE, locateSection } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import SectionIcon from './section-icon'

type SectionInspectorProps = {
  /** Shown instead of the empty state, so the pane is never just blank text. */
  settings: ReactNode
}

const copy = customizeContent.inspector
const groups = customizeContent.groups

const zoneLabel = (zone: string) => {
  if (zone === HEADER_ZONE) return groups.header
  if (zone === FOOTER_ZONE) return groups.footer
  return groups.template
}

/** The right pane: the selected section's settings, drawn by Puck's own field
 * renderer, breadcrumbed under the zone it's in — or, with nothing selected,
 * the theme settings, so there's always something to edit here. */
export default function SectionInspector({ settings }: SectionInspectorProps) {
  // Hooks
  const selected = useCustomizePuck((s) => s.selectedItem)
  const components = useCustomizePuck((s) => s.config.components)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const reducedMotion = useReducedMotion()

  // Early returns
  if (!selected) {
    return (
      <section aria-label={copy.label} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {settings}
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
      initial={reducedMotion ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.28, ease: 'easeOut' }}
      className="flex min-h-0 flex-col"
      aria-label={copy.label}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <SectionIcon type={selected.type} className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="flex min-w-0 items-baseline gap-1 truncate text-body font-semibold text-foreground normal-case">
          {crumb ? (
            <>
              <span className="font-normal text-muted-foreground">{crumb}</span>
              <span aria-hidden className="font-normal text-muted-foreground">
                ›
              </span>
            </>
          ) : null}
          <span className="truncate">{label}</span>
        </h2>
      </div>
      {hasFields ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Puck.Fields />
        </div>
      ) : (
        <p className="p-4 text-body text-muted-foreground">{copy.emptyFields}</p>
      )}
    </motion.section>
  )
}
