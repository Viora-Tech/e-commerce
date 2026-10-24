'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useDeferredValue, useState } from 'react'
import CountBadge from '@/components/layout/count-badge'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { auditTemplate } from '@/lib/customize-audit'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { useCustomizePuck } from '@/lib/customize-puck'
import { useThemePreview } from '@/lib/customize-theme-context'
import AuditPanel from './audit-panel'
import SectionsTree from './sections-tree'
import SegmentedTabs from './segmented-tabs'

type SectionsPanelProps = {
  onOpenTheme: () => void
  /** The open template's name, for the template group's heading. */
  templateLabel: string
}

type Tab = 'sections' | 'audit'

const TABS: Tab[] = ['sections', 'audit']

/**
 * The left panel's Sections view: "Sections | Audit" on a segmented switch (the Figma left
 * panel's segmented control), the audit's count beside its name so issues are noticed without
 * opening it.
 */
export default function SectionsPanel({ onOpenTheme, templateLabel }: SectionsPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.audit)
  // The audit count reads the whole page: worked out after the keystroke has painted.
  const data = useDeferredValue(useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc))
  const components = useCustomizePuck((s) => s.config.components)
  const theme = useThemePreview()
  const [tab, setTab] = useState<Tab>('sections')
  const reducedMotion = useReducedMotion()

  // Render logic
  const count = auditTemplate(
    data,
    (type) => components[type]?.defaultProps as Record<string, unknown> | undefined,
    theme,
  ).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-3">
        <SegmentedTabs
          tabs={TABS}
          value={tab}
          onChange={setTab}
          label={copy.tabsLabel}
          render={(id) => (
            <>
              {copy.tabs[id]}
              {id === 'audit' && count > 0 ? <CountBadge n={count} /> : null}
            </>
          )}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={reducedMotion ? false : { opacity: 0, transform: 'translateY(4px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15, ease: [0.23, 1, 0.32, 1] }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {tab === 'sections' ? (
            <SectionsTree templateLabel={templateLabel} />
          ) : (
            <AuditPanel onOpenTheme={onOpenTheme} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
