'use client'

import type { McpSettings } from '@commerce/core/api-access'
import { ShieldCheck } from '@commerce/ui/icons'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'

type McpPermissionsCardProps = {
  settings: McpSettings
  onSettings: (next: McpSettings) => void
}

/**
 * "Permissions & approvals": the rules in plain words as they stand right now (reads run, changes
 * follow the approval switch, sensitive ones always wait), then the three switches.
 */
export default function McpPermissionsCard({ settings, onSettings }: McpPermissionsCardProps) {
  // Hooks
  const copy = useCopy(mcpContent)

  // Render logic
  const rules = copy.permissions.rules
  const lines = [
    rules.reads,
    settings.allowChanges
      ? settings.requireApproval
        ? rules.changesApproval
        : rules.changesDirect
      : rules.changesOff,
    rules.sensitive,
    settings.readCustomers ? rules.customersOn : rules.customersOff,
  ]

  return (
    <SettingsCard title={copy.permissions.heading} description={copy.permissions.help}>
      <ul className="mb-3 flex flex-col gap-2 rounded-lg bg-muted/40 p-4">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-2 text-body text-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            {line}
          </li>
        ))}
      </ul>
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
  )
}
