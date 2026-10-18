'use client'

import type { ApiGrantView } from '@commerce/core'
import type { McpSettings } from '@commerce/core/api-access'
import { AiIcon, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { SETTINGS_CELL } from '@/components/settings/settings-table'
import { mcpContent } from '@/data/mcp'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { clientCanDo, tokenScopes } from './can-do'
import CreateTokenDialog from './create-token-dialog'
import McpClientLogo from './mcp-client-logo'

type McpClientsTabProps = {
  clients: ApiGrantView[]
  tokens: ApiGrantView[]
  settings: McpSettings
  storeName: string
  onConnect: () => void
}

const HEAD =
  'h-10 border-b border-line bg-card px-3 py-0 text-caption font-medium text-muted-foreground first:pl-4 last:pr-4 md:first:pl-6 md:last:pr-6'

/** Figma "Settings · MCP & API · Clients & tokens": who is connected, and the access tokens. */
export default function McpClientsTab({
  clients,
  tokens,
  settings,
  storeName,
  onConnect,
}: McpClientsTabProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const format = useFormat()
  const router = useRouter()
  const [revoking, setRevoking] = useState<ApiGrantView | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)

  // Helpers
  const twoLines = (first: string, second: string | null, strong = true) => (
    <span className="flex min-w-0 flex-col">
      <span className={cn('truncate', strong ? 'text-ink-strong' : 'text-foreground')}>
        {first}
      </span>
      {second ? (
        <span className="truncate text-caption text-muted-foreground">{second}</span>
      ) : null}
    </span>
  )

  const memberCell = (g: ApiGrantView) =>
    g.member
      ? twoLines(g.member.name, copy.table.memberLine(g.member.role, format.date(g.createdAt)))
      : twoLines(copy.table.removedMember, format.date(g.createdAt), false)

  const lastUsed = (g: ApiGrantView) => {
    if (g.kind === 'token' && g.status === 'expired')
      return twoLines(
        g.lastUsedAt ? format.ago(g.lastUsedAt) : copy.table.never,
        copy.table.stopped,
        false,
      )
    if (!g.lastUsedAt) return twoLines(copy.table.never, null, false)
    return twoLines(
      format.ago(g.lastUsedAt),
      g.kind === 'token' && g.lastIp ? copy.table.from(g.lastIp) : null,
      false,
    )
  }

  const menu = (g: ApiGrantView) => (
    <ActionMenu
      label={copy.table.actions(g.name)}
      trigger="kebab-vertical"
      items={[{ label: copy.table.revoke, destructive: true, onSelect: () => setRevoking(g) }]}
    />
  )

  // Event handlers
  const handleRevoke = async () => {
    if (!revoking) return
    setBusy(true)
    try {
      await api.apiAccess.revoke({ id: revoking.id })
      toast.success(copy.revoke.done(revoking.name))
      setRevoking(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.revoke.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const revokeBody = revoking
    ? revoking.kind === 'oauth'
      ? copy.revoke.client(revoking.name, storeName, revoking.member?.name ?? '')
      : copy.revoke.token(revoking.name)
    : undefined

  return (
    <div className="flex flex-col gap-4">
      <DataCard title={copy.table.clientsHeading} flush>
        {clients.length === 0 ? (
          <EmptyState
            variant="plain"
            icon={AiIcon}
            heading={copy.empty.title}
            body={copy.empty.body(storeName)}
            action={
              <Button variant="outline" onClick={onConnect}>
                {copy.empty.action}
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>{copy.table.client}</TableHead>
                <TableHead className={cn(HEAD, 'hidden md:table-cell')}>
                  {copy.table.connectedBy}
                </TableHead>
                <TableHead className={cn(HEAD, 'hidden lg:table-cell')}>
                  {copy.table.canDo}
                </TableHead>
                <TableHead className={HEAD}>{copy.table.lastUsed}</TableHead>
                <TableHead className={cn(HEAD, 'w-16')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((g) => {
                const can = clientCanDo(copy, g.scopes, settings.requireApproval)
                return (
                  <TableRow key={g.id}>
                    <TableCell className={SETTINGS_CELL}>
                      <span className="flex items-center gap-3">
                        <McpClientLogo client={g.client} />
                        {twoLines(g.name, copy.table.viaOAuth)}
                      </span>
                    </TableCell>
                    <TableCell className={cn(SETTINGS_CELL, 'hidden md:table-cell')}>
                      {memberCell(g)}
                    </TableCell>
                    <TableCell className={cn(SETTINGS_CELL, 'hidden max-w-72 lg:table-cell')}>
                      {twoLines(can.first, can.second)}
                    </TableCell>
                    <TableCell className={SETTINGS_CELL}>{lastUsed(g)}</TableCell>
                    <TableCell className={SETTINGS_CELL}>{menu(g)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DataCard>

      <DataCard
        title={copy.table.tokensHeading}
        flush
        action={
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            {copy.table.createToken}
          </Button>
        }
      >
        {tokens.length === 0 ? (
          <EmptyState
            variant="plain"
            size="sm"
            heading={copy.table.noTokens}
            body={copy.table.noTokensBody}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>{copy.table.name}</TableHead>
                <TableHead className={cn(HEAD, 'hidden md:table-cell')}>
                  {copy.table.scopes}
                </TableHead>
                <TableHead className={cn(HEAD, 'hidden sm:table-cell')}>
                  {copy.table.expires}
                </TableHead>
                <TableHead className={HEAD}>{copy.table.lastUsed}</TableHead>
                <TableHead className={cn(HEAD, 'w-16')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((g) => {
                const scopes = tokenScopes(copy, g.scopes)
                return (
                  <TableRow key={g.id}>
                    <TableCell className={SETTINGS_CELL}>
                      {twoLines(g.name, [g.hint, g.member?.name].filter(Boolean).join(' · '))}
                    </TableCell>
                    <TableCell className={cn(SETTINGS_CELL, 'hidden md:table-cell')}>
                      {twoLines(scopes.first, scopes.second)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        SETTINGS_CELL,
                        'hidden sm:table-cell',
                        g.status === 'expired' && 'text-danger',
                      )}
                    >
                      {g.expiresAt
                        ? g.status === 'expired'
                          ? copy.table.expired(format.date(g.expiresAt))
                          : format.date(g.expiresAt)
                        : copy.table.expiresNever}
                    </TableCell>
                    <TableCell className={SETTINGS_CELL}>{lastUsed(g)}</TableCell>
                    <TableCell className={SETTINGS_CELL}>{menu(g)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DataCard>
      <p className="text-caption text-muted-foreground">{copy.table.tokensNote}</p>

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => (open ? null : setRevoking(null))}
        title={revoking ? copy.revoke.title(revoking.name) : ''}
        body={revokeBody}
        confirmLabel={copy.revoke.confirm}
        cancelLabel={copy.revoke.keep}
        tone="destructive"
        busy={busy}
        onConfirm={handleRevoke}
      />
      <CreateTokenDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
