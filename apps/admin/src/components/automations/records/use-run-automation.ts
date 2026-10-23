'use client'

import { permissions } from '@commerce/core/permissions'
import { FileText, Workflow } from '@commerce/ui/icons'
import { useState } from 'react'
import type { ActionItem } from '@/components/layout/action-menu'
import { type AutomationRecordType, automationRecordsContent } from '@/data/automation-records'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { automationRoutes } from '@/lib/automation-routes'

/**
 * "Run automation" for a detail page's More actions or a list's bulk bar: the menu items and
 * the ids the `RunAutomationDialog` opens on. Empty unless the Automations app is installed
 * (`installed`) and the member may run automations.
 */
export function useRunAutomation(subjectType: AutomationRecordType, installed: boolean) {
  // Hooks
  const copy = useCopy(automationRecordsContent)
  const { hasPermission } = usePermissions()
  const [target, setTarget] = useState<string[] | null>(null)

  // Helpers
  const enabled = installed && hasPermission(permissions.AUTOMATIONS_RUN)
  const canRead = installed && hasPermission(permissions.AUTOMATIONS_READ)

  /**
   * `runsLink` adds "Automation runs" (the runs page filtered to the one record); `heading`
   * titles the group "Automations" (menus where apps' items sit under their names).
   */
  const items = (
    ids: string[],
    opts: { runsLink?: boolean; heading?: boolean } = {},
  ): ActionItem[] => {
    const [first] = ids
    const all: ActionItem[] = [
      {
        id: 'automations:run',
        label: copy.run,
        icon: Workflow,
        hidden: !enabled || !first,
        onSelect: () => setTarget(ids),
      },
      {
        id: 'automations:runs',
        label: copy.runs,
        icon: FileText,
        hidden: !opts.runsLink || !canRead || ids.length !== 1 || !first,
        href: automationRoutes.recordRuns(subjectType, first ?? ''),
      },
    ]
    return all
      .filter((item) => !item.hidden)
      .map((item, i) => (i === 0 && opts.heading ? { ...item, heading: copy.history.title } : item))
  }

  return { items, target, close: () => setTarget(null) }
}
