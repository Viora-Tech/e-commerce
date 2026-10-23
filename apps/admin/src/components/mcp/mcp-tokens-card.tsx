'use client'

import type { ApiGrantView } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
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
import { tokenScopes } from './can-do'
import { MCP_CELL as CELL, MCP_HEAD as HEAD } from './table-classes'
import TwoLines from './two-lines'

type McpTokensCardProps = {
  tokens: ApiGrantView[]
  onCreate: () => void
  onRevoke: (grant: ApiGrantView) => void
}

/** "API tokens": every token, used or not, with its areas, expiry and Revoke. */
export default function McpTokensCard({ tokens, onCreate, onRevoke }: McpTokensCardProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const format = useFormat()

  // Helpers
  const expires = (g: ApiGrantView) => {
    if (!g.expiresAt) return copy.table.expiresNever
    return g.status === 'expired'
      ? copy.table.expired(format.date(g.expiresAt))
      : format.date(g.expiresAt)
  }

  // Render logic
  return (
    <SettingsCard
      title={copy.table.tokensHeading}
      description={copy.table.tokensHelp}
      footer={
        <Button variant="outline" onClick={onCreate}>
          <Plus aria-hidden="true" />
          {copy.table.createToken}
        </Button>
      }
    >
      {tokens.length === 0 ? (
        <EmptyState
          variant="dashed"
          size="sm"
          heading={copy.table.noTokens}
          body={copy.table.noTokensBody}
        />
      ) : (
        <div className="-mx-6 border-y border-line">
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
                <TableHead className={cn(HEAD, 'hidden sm:table-cell')}>
                  {copy.table.lastUsed}
                </TableHead>
                <TableHead className={cn(HEAD, 'w-0')} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((g) => {
                const scopes = tokenScopes(copy, g.scopes)
                return (
                  <TableRow key={g.id} className="last:[&>td]:border-b-0">
                    <TableCell className={CELL}>
                      <TwoLines
                        first={g.name}
                        second={[g.hint, g.member?.name].filter(Boolean).join(' · ')}
                      />
                    </TableCell>
                    <TableCell className={cn(CELL, 'hidden max-w-72 md:table-cell')}>
                      <TwoLines first={scopes.first} second={scopes.second} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        'hidden sm:table-cell',
                        g.status === 'expired' && 'text-danger',
                      )}
                    >
                      {expires(g)}
                    </TableCell>
                    <TableCell className={cn(CELL, 'hidden sm:table-cell')}>
                      <TwoLines
                        first={g.lastUsedAt ? format.ago(g.lastUsedAt) : copy.table.never}
                        second={g.status === 'expired' ? copy.table.stopped : null}
                        strong={false}
                      />
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right')}>
                      <Button variant="outline" size="sm" onClick={() => onRevoke(g)}>
                        {copy.table.revoke}
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
