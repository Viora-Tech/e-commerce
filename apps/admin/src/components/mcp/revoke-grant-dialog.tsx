'use client'

import type { ApiGrantView } from '@commerce/core'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RevokeGrantDialogProps = {
  /** The app or token to cut off; null closes the dialog. */
  grant: ApiGrantView | null
  storeName: string
  onClose: () => void
}

/** "Disconnect Claude Code?" / "Revoke Inventory sync?": stops it on its next call. */
export default function RevokeGrantDialog({ grant, storeName, onClose }: RevokeGrantDialogProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleConfirm = async () => {
    if (!grant) return
    setBusy(true)
    try {
      await api.apiAccess.revoke({ id: grant.id })
      toast.success(copy.revoke.done(grant.name))
      onClose()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.revoke.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const oauth = grant?.kind === 'oauth'
  const title = grant
    ? oauth
      ? copy.revoke.disconnectTitle(grant.name)
      : copy.revoke.title(grant.name)
    : ''
  const body = grant
    ? oauth
      ? copy.revoke.client(grant.name, storeName, grant.member?.name ?? '')
      : copy.revoke.token(grant.name)
    : undefined

  return (
    <ConfirmDialog
      open={grant !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      title={title}
      body={body}
      confirmLabel={oauth ? copy.revoke.disconnect : copy.revoke.confirm}
      cancelLabel={copy.revoke.keep}
      tone="destructive"
      busy={busy}
      onConfirm={handleConfirm}
    />
  )
}
