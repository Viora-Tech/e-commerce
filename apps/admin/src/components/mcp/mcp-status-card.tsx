'use client'

import { API_RATE_LIMIT } from '@commerce/core/api-access'
import { cn } from '@commerce/ui/lib/utils'
import StatusChip from '@/components/layout/status-chip'
import { mcpContent } from '@/data/mcp'
import { useCopy, useFormat } from '@/hooks/use-copy'
import CodeSnippet from './code-snippet'

type McpStatusCardProps = {
  /** Live connections: apps signed in plus API tokens in use. */
  connected: number
  lastRequestAt: Date | null
  serverUrl: string
}

/** The page's first card: connected or not, when the last request came, and the server URL. */
export default function McpStatusCard({ connected, lastRequestAt, serverUrl }: McpStatusCardProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const format = useFormat()

  // Render logic
  const facts = [
    { label: copy.status.signIn, value: copy.status.signInValue },
    { label: copy.status.limits, value: copy.status.limitsValue(API_RATE_LIMIT.limit) },
  ]

  return (
    <section className="flex flex-col gap-5 rounded-xl surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            className={cn(
              'text-card-title',
              connected ? 'text-ink-strong' : 'text-muted-foreground',
            )}
          >
            {connected ? copy.status.connected(connected) : copy.status.notConnected}
          </h2>
          <p className="text-caption text-muted-foreground">
            {connected
              ? lastRequestAt
                ? copy.status.lastRequest(format.ago(lastRequestAt))
                : copy.status.noRequests
              : copy.status.notConnectedBody}
          </p>
        </div>
        <StatusChip tone={connected ? 'success' : 'neutral'} variant="dot">
          {connected ? copy.status.live : copy.status.waiting}
        </StatusChip>
      </div>
      <div className="flex flex-col gap-1.5">
        <CodeSnippet value={serverUrl} what={copy.status.url} label={copy.status.url} />
        <p className="text-caption text-muted-foreground">{copy.status.urlHelp}</p>
      </div>
      <dl className="grid gap-3 text-body sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-0.5">
            <dt className="text-caption text-muted-foreground">{f.label}</dt>
            <dd className="text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
