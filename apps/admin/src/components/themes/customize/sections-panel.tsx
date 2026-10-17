'use client'

import { cn } from '@commerce/ui/lib/utils'
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

  // Render logic
  const count = auditTemplate(
    data,
    (type) => components[type]?.defaultProps as Record<string, unknown> | undefined,
    theme,
  ).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-3">
        <div
          role="tablist"
          aria-label={copy.tabsLabel}
          className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5"
        >
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'flex h-7 items-center justify-center gap-1.5 rounded-md text-xs leading-[1.0625rem] font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
                tab === id && 'bg-card text-foreground shadow-card',
              )}
            >
              {copy.tabs[id]}
              {id === 'audit' && count > 0 ? <CountBadge n={count} /> : null}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
        {tab === 'sections' ? (
          <SectionsTree templateLabel={templateLabel} />
        ) : (
          <AuditPanel onOpenTheme={onOpenTheme} />
        )}
      </div>
    </div>
  )
}
