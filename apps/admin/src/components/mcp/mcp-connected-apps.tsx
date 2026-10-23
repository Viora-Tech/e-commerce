'use client'

import type { ApiGrantView } from '@commerce/core'
import type { McpSettings } from '@commerce/core/api-access'
import { AiIcon } from '@commerce/ui/icons'
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
import EmptyState from '@/components/layout/empty-state'
import SettingsCard from '@/components/settings/settings-card'
import { mcpContent } from '@/data/mcp'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { clientCanDo, tokenScopes } from './can-do'
import McpClientLogo from './mcp-client-logo'
import { MCP_CELL as CELL, MCP_HEAD as HEAD } from './table-classes'
import TwoLines from './two-lines'

type McpConnectedAppsProps = {
  /** Apps that signed in (OAuth) and API tokens that have been used, newest first. */
  apps: ApiGrantView[]
  settings: McpSettings
  onDisconnect: (grant: ApiGrantView) => void
}

/**
 * "Connected AI apps": every live connection, whichever way it connects. Apps that signed in
 * show their registered name (Claude, Claude Code, Cursorâ€¦); a token shows its own name.
 */
export default function McpConnectedApps({ apps, settings, onDisconnect }: McpConnectedAppsProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const format = useFormat()

  // Helpers
  const canDo = (g: ApiGrantView) => {
    if (g.kind === 'oauth') return clientCanDo(copy, g.scopes, settings.requireApproval)
    const s = tokenScopes(copy, g.scopes)
    return { first: s.first, second: `${s.second} Â· ${copy.connected.tokenRuns}` }
  }

  const via = (g: ApiGrantView) => {
    if (g.kind === 'token') return copy.connected.viaToken(g.hint)
    return g.status === 'expired' ? copy.connected.lapsed : copy.connected.viaOAuth
  }

  // Render logic
  return (
    <SettingsCard title={copy.connected.heading} description={copy.connected.help}>
      {apps.length === 0 ? (
        <EmptyState
          variant="dashed"
          size="sm"
          icon={AiIcon}
          heading={copy.connected.emptyTitle}
          body={copy.connected.emptyBody}
        />
      ) : (
        <div className="-mx-6 -mb-6 border-t border-line">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={HEAD}>{copy.connected.app}</TableHead>
                <TableHead className={cn(HEAD, 'hidden md:table-cell')}>
                  {copy.connected.connectedBy}
                </TableHead>
                <TableHead className={cn(HEAD, 'hidden lg:table-cell')}>
                  {copy.connected.canDo}
                </TableHead>
                <TableHead className={cn(HEAD, 'hidden sm:table-cell')}>
                  {copy.connected.lastUsed}
                </TableHead>
                <TableHead className={cn(HEAD, 'w-0')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((g) => {
                const can = canDo(g)
                return (
                  <TableRow key={g.id} className="last:[&>td]:border-b-0">
                    <TableCell className={CELL}>
                      <span className="flex min-w-0 items-center gap-3">
                        <McpClientLogo client={g.client} />
                        <TwoLines first={g.name} second={via(g)} />
                      </span>
                    </TableCell>
                    <TableCell className={cn(CELL, 'hidden md:table-cell')}>
                      <TwoLines
                        first={g.member?.name ?? copy.table.removedMember}
                        second={
                          g.member
                            ? copy.table.memberLine(g.member.role, format.date(g.createdAt))
                            : format.date(g.createdAt)
                        }
                        strong={g.member !== null}
                      />
                    </TableCell>
                    <TableCell className={cn(CELL, 'hidden max-w-72 lg:table-cell')}>
                      <TwoLines first={can.first} second={can.second} />
                    </TableCell>
                    <TableCell className={cn(CELL, 'hidden sm:table-cell')}>
                      <TwoLines
                        first={g.lastUsedAt ? format.ago(g.lastUsedAt) : copy.table.never}
                        second={g.lastIp ? copy.table.from(g.lastIp) : null}
                        strong={false}
                      />
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right')}>
                      <Button variant="outline" size="sm" onClick={() => onDisconnect(g)}>
                        {g.kind === 'oauth' ? copy.connected.disconnect : copy.table.revoke}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </SettingsCard>
  )
}
