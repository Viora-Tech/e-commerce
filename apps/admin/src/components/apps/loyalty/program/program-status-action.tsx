'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type ProgramStatusActionProps = {
  /** The saved settings: only the status changes, never unsaved edits on the page. */
  settings: LoyaltySettings
  onChanged: (next: LoyaltySettings) => void
  /** The go-live button's text when it is not the header's "Enable" (the setup bar's step). */
  goLiveLabel?: string
}

/** Go live at once, or pause after a confirm (only test accounts keep the program). */
export default function ProgramStatusAction({
  settings,
  onChanged,
  goLiveLabel,
}: ProgramStatusActionProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSet = async (programStatus: LoyaltySettings['programStatus']) => {
    setBusy(true)
    try {
      const next = await api.loyalty.settings.save({ ...settings, programStatus })
      onChanged(next)
      toast.success(programStatus === 'live' ? copy.status.wentLive : copy.status.paused2)
      setConfirming(false)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const live = settings.programStatus === 'live'

  return (
    <>
      {live ? (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          {copy.status.pause}
        </Button>
      ) : (
        <Button onClick={() => handleSet('live')} loading={busy}>
          {goLiveLabel ?? copy.status.enable}
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.status.pauseTitle}
        body={copy.status.pauseBody}
        confirmLabel={copy.status.pause}
        tone="destructive"
        busy={busy}
        onConfirm={() => handleSet('paused')}
      />
    </>
  )
}
