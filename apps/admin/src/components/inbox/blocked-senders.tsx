'use client'

import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { inboxContent } from '@/data/inbox'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'

type Block = Awaited<ReturnType<typeof api.inbox.blocks.list>>[number]

/** Blocked browsers, emails and internet addresses (only hashes are kept), with Unblock. */
export default function BlockedSenders() {
  // Hooks
  const copy = useCopy(inboxContent)
  const fmt = useFormat()
  const { hasPermission } = usePermissions()
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api.inbox.blocks
      .list()
      .then((rows) => {
        if (live) setBlocks(rows)
      })
      .catch(() => {
        if (live) setBlocks([])
      })
    return () => {
      live = false
    }
  }, [])

  // Event handlers
  const handleUnblock = async (id: string) => {
    setBusy(id)
    try {
      await api.inbox.blocks.remove({ id })
      setBlocks((rows) => (rows ?? []).filter((b) => b.id !== id))
      toast.success(copy.blocks.unblocked)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  if (!blocks) return <Skeleton className="h-32 w-full rounded-2xl" />

  // Render logic
  const b = copy.blocks
  const canReply = hasPermission(permissions.INBOX_REPLY)

  return (
    <SettingsTable
      heading={b.title}
      description={b.description}
      columns={[
        { label: b.columns.sender },
        { label: b.columns.reason, className: 'hidden sm:table-cell' },
        { label: b.columns.until, className: 'hidden md:table-cell' },
      ]}
      actions={canReply}
      after={blocks.length === 0 ? <EmptyState heading={b.empty} /> : undefined}
    >
      {blocks.map((block) => (
        <SettingsTableRow key={block.id}>
          <SettingsTableCell>
            <span className="flex flex-col">
              <span className="text-body-strong">
                {block.contactName ?? block.contactEmail ?? b.unknown}
              </span>
              <span className="text-caption text-muted-foreground">{b.kinds[block.kind]}</span>
            </span>
          </SettingsTableCell>
          <SettingsTableCell className="hidden sm:table-cell">
            {b.reasons[block.reason]}
          </SettingsTableCell>
          <SettingsTableCell className="hidden md:table-cell">
            {block.expiresAt ? b.expires(fmt.date(block.expiresAt)) : b.forever}
          </SettingsTableCell>
          {canReply ? (
            <SettingsTableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                loading={busy === block.id}
                disabled={busy !== null}
                onClick={() => handleUnblock(block.id)}
              >
                {b.unblock}
              </Button>
            </SettingsTableCell>
          ) : null}
        </SettingsTableRow>
      ))}
    </SettingsTable>
  )
}
