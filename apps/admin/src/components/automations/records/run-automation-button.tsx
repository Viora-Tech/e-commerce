'use client'

import { Workflow } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { AutomationRecordType } from '@/data/automation-records'
import RunAutomationDialog from './run-automation-dialog'
import { useRunAutomation } from './use-run-automation'

type RunAutomationButtonProps = {
  subjectType: AutomationRecordType
  ids: string[]
  /** The Automations app is installed; nothing renders otherwise. */
  installed: boolean
  /** After runs were queued: clear the selection. */
  onDone?: (() => void) | undefined
}

/** "Run automation" as a selection-bar button, for lists whose bulk bar has no More menu. */
export default function RunAutomationButton({
  subjectType,
  ids,
  installed,
  onDone,
}: RunAutomationButtonProps) {
  // Hooks
  const automation = useRunAutomation(subjectType, installed)

  // Early returns
  const [item] = automation.items(ids)
  if (!item) return null

  // Render logic
  return (
    <>
      <Button variant="outline" size="sm" onClick={item.onSelect}>
        <Workflow aria-hidden="true" />
        {item.label}
      </Button>
      <RunAutomationDialog
        subjectType={subjectType}
        ids={automation.target}
        onClose={automation.close}
        onDone={onDone}
      />
    </>
  )
}
