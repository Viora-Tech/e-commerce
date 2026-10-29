'use client'

import type { RolloutView } from '@commerce/core'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import { useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import RolloutOption from './rollout-option'

type RolloutEndDialogProps = {
  rollout: RolloutView | null
  onClose: () => void
  onEnd: (action: RolloutView['endAction']) => Promise<void>
}

/** "End now": roll the event's changes back, or keep them for good. */
export default function RolloutEndDialog({ rollout, onClose, onEnd }: RolloutEndDialogProps) {
  // Hooks
  const { form: copy } = useCopy(rolloutsContent)
  const [action, setAction] = useState<RolloutView['endAction']>(rollout?.endAction ?? 'rollback')

  return (
    <ConfirmDialog
      open={rollout !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={copy.end.title(rollout?.name ?? '')}
      body={copy.end.body}
      confirmLabel={copy.end.confirm}
      tone="destructive"
      onConfirm={() => onEnd(action)}
    >
      <RadioGroup
        value={action}
        onValueChange={(v) => setAction(v === 'apply' ? 'apply' : 'rollback')}
      >
        <RolloutOption
          id="rollout-end-now-rollback"
          value="rollback"
          label={copy.schedule.rollback}
          help={copy.schedule.rollbackHelp}
        />
        <RolloutOption
          id="rollout-end-now-apply"
          value="apply"
          label={copy.schedule.apply}
          help={copy.schedule.applyHelp}
        />
      </RadioGroup>
    </ConfirmDialog>
  )
}
