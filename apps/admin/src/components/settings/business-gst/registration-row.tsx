'use client'

import type { GstRegistrationView } from '@commerce/core'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import StatusChip from '@/components/layout/status-chip'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RegistrationRowProps = {
  registration: GstRegistrationView
  /** The business's name, shown only when the store has more than one. */
  owner: string | null
  canManage: boolean
}

/** One GST number: state, GSTIN, badges, and Make default / Mark as cancelled. */
export default function RegistrationRow({
  registration: r,
  owner,
  canManage,
}: RegistrationRowProps) {
  // Hooks
  const { registrations: copy } = useCopy(businessGstContent)
  const router = useRouter()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleMakeDefault = () =>
    run(() => api.businessGst.setDefault({ id: r.id }), copy.madeDefault)

  const handleCancel = async () => {
    setConfirmCancel(false)
    await run(() => api.businessGst.cancelRegistration({ id: r.id }), copy.didCancel)
  }

  // Render logic
  const actionable = canManage && r.active

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-body-strong text-ink-strong">
          {r.stateName}
          {r.isDefault ? <StatusChip tone="success">{copy.default}</StatusChip> : null}
          {r.registrationType === 'composition' ? (
            <StatusChip tone="neutral">{copy.composition}</StatusChip>
          ) : null}
          {r.active ? null : <StatusChip tone="neutral">{copy.cancelled}</StatusChip>}
        </span>
        <span className="font-mono text-body text-muted-foreground">{r.gstin}</span>
        {owner ? (
          <span className="text-caption text-muted-foreground">{copy.belongsTo(owner)}</span>
        ) : null}
      </div>
      {actionable ? (
        <ActionMenu
          label={copy.actions}
          trigger="kebab-vertical"
          size="md"
          disabled={busy}
          items={[
            { label: copy.makeDefault, hidden: r.isDefault, onSelect: handleMakeDefault },
            { label: copy.cancel, destructive: true, onSelect: () => setConfirmCancel(true) },
          ]}
        />
      ) : null}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={copy.cancelTitle}
        body={copy.cancelBody}
        confirmLabel={copy.confirmCancel}
        cancelLabel={copy.keep}
        onConfirm={handleCancel}
      />
    </li>
  )
}
