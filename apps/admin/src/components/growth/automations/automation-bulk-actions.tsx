'use client'

import { Pause, Play } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { automationsContent } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched } from '@/lib/run-batched'

type AutomationBulkActionsProps = {
  ids: string[]
  clear: () => void
}

type Status = 'active' | 'paused'

/** Turn the selected automations on or off, one call each, ten at a time. */
export default function AutomationBulkActions({ ids, clear }: AutomationBulkActionsProps) {
  // Hooks
  const { bulk: copy } = useCopy(automationsContent)
  const router = useRouter()
  const [confirm, setConfirm] = useState<Status | null>(null)

  // Event handlers
  const handleConfirm = async () => {
    const status = confirm
    if (!status) return
    const { done, failed } = await runBatched(ids, (id) =>
      api.marketing.automations.setStatus({ id, status }),
    )
    const message = status === 'active' ? copy.turnedOn(done) : copy.turnedOff(done)
    if (failed === 0) toast.success(message)
    else toast.warning(`${message} · ${copy.failed(failed)}`)
    clear()
    router.refresh()
  }

  // Render logic
  const on = confirm === 'active'

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirm('active')}>
        <Play aria-hidden="true" />
        {copy.turnOn}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirm('paused')}>
        <Pause aria-hidden="true" />
        {copy.turnOff}
      </Button>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={on ? copy.turnOnTitle(ids.length) : copy.turnOffTitle(ids.length)}
        body={on ? copy.turnOnBody : copy.turnOffBody}
        confirmLabel={on ? copy.turnOn : copy.turnOff}
        cancelLabel={copy.cancel}
        tone="default"
        onConfirm={handleConfirm}
      />
    </>
  )
}
