'use client'

import type { McpOverview } from '@commerce/core'
import {
  API_RATE_LIMIT,
  MCP_CLIENTS,
  type McpClientId,
  type McpSettings,
} from '@commerce/core/api-access'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { mcpContent } from '@/data/mcp'
import { useCopy, useFormat } from '@/hooks/use-copy'
import McpClientLogo from './mcp-client-logo'

type McpOverviewTabProps = {
  overview: McpOverview
  serverUrl: string
  settings: McpSettings
  onSettings: (next: McpSettings) => void
  onConnect: (client: McpClientId) => void
}

/** Figma "Settings · MCP & API · Overview": the server, the four clients, and the switches. */
export default function McpOverviewTab({
  overview,
  serverUrl,
  settings,
  onSettings,
  onConnect,
}: McpOverviewTabProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const format = useFormat()

  // Render logic
  const rows = [
    {
      id: 'status',
      label: copy.server.status,
      help: overview.lastRequestAt
        ? copy.server.lastRequest(format.ago(overview.lastRequestAt))
        : copy.server.noRequests,
      value: overview.clients ? copy.server.online(overview.clients) : copy.server.waiting,
    },
    {
      id: 'sign-in',
      label: copy.server.signIn,
      help: copy.server.signInHelp,
      value: copy.server.signInValue,
    },
    {
      id: 'limits',
      label: copy.server.limits,
      help: copy.server.limitsHelp,
      value: copy.server.limitsValue(API_RATE_LIMIT.limit),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <DataCard
        title={copy.server.heading}
        subtitle={copy.server.help(overview.store.name)}
        bodyClassName="flex flex-col gap-1"
      >
        <div className="group/row flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-caption text-muted-foreground">{copy.server.url}</span>
            <span className="truncate font-mono text-body text-ink-strong">{serverUrl}</span>
          </div>
          <CopyButton value={serverUrl} what={copy.server.url} visible />
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-body"
          >
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-ink-strong">{r.label}</span>
              <span className="text-caption text-muted-foreground">{r.help}</span>
            </span>
            <span className="text-foreground">{r.value}</span>
          </div>
        ))}
      </DataCard>

      <DataCard title={copy.connect.heading} subtitle={copy.connect.help}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MCP_CLIENTS.map((id) => {
            const c = copy.clients[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => onConnect(id)}
                className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-input transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <McpClientLogo client={id} size="lg" />
                <span className="flex flex-col">
                  <span className="text-card-title text-ink-strong">{c.name}</span>
                  <span className="text-caption text-muted-foreground">{c.by}</span>
                </span>
                <span className="text-caption text-muted-foreground">{c.blurb}</span>
                {overview.connected[id] ? (
                  <StatusChip tone="success" variant="dot">
                    {copy.connect.connected}
                  </StatusChip>
                ) : (
                  <StatusChip tone="info">{copy.connect.connect}</StatusChip>
                )}
              </button>
            )
          })}
        </div>
      </DataCard>

      <SettingsCard title={copy.switches.heading}>
        <SettingsToggleRow
          id="mcp-allow-changes"
          label={copy.switches.allowChanges}
          description={copy.switches.allowChangesHelp}
          checked={settings.allowChanges}
          onChange={(on) => onSettings({ ...settings, allowChanges: on })}
        />
        <SettingsToggleRow
          id="mcp-require-approval"
          label={copy.switches.requireApproval}
          description={copy.switches.requireApprovalHelp}
          checked={settings.requireApproval}
          onChange={(on) => onSettings({ ...settings, requireApproval: on })}
        />
        <SettingsToggleRow
          id="mcp-read-customers"
          label={copy.switches.readCustomers}
          description={copy.switches.readCustomersHelp}
          checked={settings.readCustomers}
          onChange={(on) => onSettings({ ...settings, readCustomers: on })}
        />
      </SettingsCard>
    </div>
  )
}
