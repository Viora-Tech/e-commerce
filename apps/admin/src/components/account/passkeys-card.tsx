'use client'

import { describeUserAgent } from '@commerce/core/member-account'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { accountContent } from '@/data/account'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { authClient, authErrorCode } from '@/lib/auth-client'
import PasskeyNameDialog from './passkey-name-dialog'

type Passkey = { id: string; name?: string | null; createdAt: Date | string; backedUp: boolean }

type Naming = { mode: 'add' } | { mode: 'rename'; passkey: Passkey }

const noSubscription = () => () => {}

/** WebAuthn is a browser feature; the server render assumes it is there. */
const browserSupportsPasskeys = () => typeof window.PublicKeyCredential === 'function'

/** "Chrome on Windows" for this browser, as a starting name for a new passkey. */
function thisDeviceName(unnamed: string): string {
  const d = describeUserAgent(navigator.userAgent)
  return [d.browser, d.os].filter(Boolean).join(' on ') || unnamed
}

/** Account → Sign-in & security → Passkeys: list, add (named first), rename and remove. */
export default function PasskeysCard() {
  // Hooks
  const {
    security: { passkeys: copy },
  } = useCopy(accountContent)
  const fmt = useFormat()
  const supported = useSyncExternalStore(noSubscription, browserSupportsPasskeys, () => true)
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null)
  const [version, setVersion] = useState(0)
  const [naming, setNaming] = useState<Naming | null>(null)
  const [removing, setRemoving] = useState<Passkey | null>(null)
  const [busy, setBusy] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a change
  useEffect(() => {
    authClient.passkey.listUserPasskeys().then(({ data }) => setPasskeys(data ?? []))
  }, [version])

  // Helpers
  const labelOf = (p: Passkey) => p.name || copy.unnamed

  // Event handlers
  const handleName = async (name: string) => {
    if (!naming) return
    setBusy(true)
    try {
      const { error } =
        naming.mode === 'add'
          ? await authClient.passkey.addPasskey({ name })
          : await authClient.passkey.updatePasskey({ id: naming.passkey.id, name })
      if (error) {
        const cancelled = authErrorCode(error).includes('ABORTED')
        toast.error(cancelled ? copy.cancelled : (error.message ?? copy.failed))
        return
      }
      toast.success(naming.mode === 'add' ? copy.created : copy.renamed)
      setNaming(null)
      setVersion((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      const { error } = await authClient.passkey.deletePasskey({ id: removing.id })
      if (error) {
        toast.error(error.message ?? copy.failed)
        return
      }
      toast.success(copy.removed)
      setRemoving(null)
      setVersion((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const nameTitle = naming ? (naming.mode === 'add' ? copy.add : copy.rename) : null
  const initialName =
    naming?.mode === 'rename' ? labelOf(naming.passkey) : naming ? thisDeviceName(copy.unnamed) : ''

  return (
    <SettingsCard id="passkeys" title={copy.heading} description={copy.body}>
      <div className="flex flex-col gap-4">
        {passkeys === null ? (
          <Skeleton className="h-12 w-full" />
        ) : passkeys.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col">
            {passkeys.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-body font-semibold text-ink-strong">
                      {labelOf(p)}
                    </span>
                    {p.backedUp ? <StatusChip>{copy.synced}</StatusChip> : null}
                  </div>
                  <span className="text-caption text-muted-foreground">
                    {copy.added(fmt.date(p.createdAt))}
                  </span>
                </div>
                <ActionMenu
                  label={labelOf(p)}
                  variant="ghost"
                  items={[
                    {
                      label: copy.rename,
                      onSelect: () => setNaming({ mode: 'rename', passkey: p }),
                    },
                    { label: copy.remove, destructive: true, onSelect: () => setRemoving(p) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
        {supported ? (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => setNaming({ mode: 'add' })}
          >
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        ) : (
          <p className="text-caption text-muted-foreground">{copy.unsupported}</p>
        )}
      </div>
      <PasskeyNameDialog
        title={nameTitle}
        initialName={initialName}
        submitLabel={naming?.mode === 'rename' ? copy.save : copy.add}
        busy={busy}
        onCancel={() => setNaming(null)}
        onSubmit={handleName}
      />
      <ConfirmDialog
        open={removing !== null}
        title={copy.removeDialog.title(removing ? labelOf(removing) : '')}
        body={copy.removeDialog.body}
        confirmLabel={copy.removeDialog.confirm}
        cancelLabel={copy.removeDialog.cancel}
        busy={busy}
        onOpenChange={(open) => !open && !busy && setRemoving(null)}
        onConfirm={handleRemove}
      />
    </SettingsCard>
  )
}
