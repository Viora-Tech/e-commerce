'use client'

import type { ApiGrantView, McpOverview } from '@commerce/core'
import type { McpSettings } from '@commerce/core/api-access'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsDrill from '@/components/settings/settings-drill'
import SettingsDrillPanel from '@/components/settings/settings-drill-panel'
import SettingsLinkRow from '@/components/settings/settings-link-row'
import SettingsList from '@/components/settings/settings-list'
import { mcpContent } from '@/data/mcp'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { settingsRowsContent } from '@/data/settings-rows'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CreateTokenDialog from './create-token-dialog'
import McpConnectGuide from './mcp-connect-guide'
import McpConnectedApps from './mcp-connected-apps'
import McpPermissionsCard from './mcp-permissions-card'
import McpStatusCard from './mcp-status-card'
import McpTokensCard from './mcp-tokens-card'
import RevokeGrantDialog from './revoke-grant-dialog'

type McpPageProps = {
  overview: McpOverview
  grants: { clients: ApiGrantView[]; tokens: ApiGrantView[] }
  serverUrl: string
}

/**
 * Settings → MCP & API, Shopify-style (#147): the status, then rows for the connect guide,
 * connected apps, permissions and approvals and API tokens, each opening in place (`?open=`),
 * and a row to the activity log.
 */
export default function McpPage({ overview, grants, serverUrl }: McpPageProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const rowsCopy = useCopy(settingsRowsContent)
  const settingsCopy = useCopy(settingsContent)
  const router = useRouter()
  const [settings, setSettings] = useState<McpSettings>(overview.settings)
  const [saved, setSaved] = useState<McpSettings>(overview.settings)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<ApiGrantView | null>(null)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const next = await api.apiAccess.saveSettings(settings)
      setSettings(next)
      setSaved(next)
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const store = overview.store.name
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved)
  // Every app that signed in, plus tokens something has actually called with.
  const apps = [...grants.clients, ...grants.tokens.filter((t) => t.lastUsedAt)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const live = apps.filter((g) => g.status === 'active').length
  const m = rowsCopy.mcp
  const rows = [
    { id: 'connect', title: m.connect, value: m.connectValue },
    { id: 'apps', title: m.apps, value: m.appsValue(live) },
    {
      id: 'permissions',
      title: m.permissions,
      value: m.permissionsValue(settings.allowChanges, settings.readCustomers),
    },
    {
      id: 'tokens',
      title: m.tokens,
      value: m.tokensValue(grants.tokens.filter((t) => t.status === 'active').length),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={settingsCopy.general.unsaved}
        saveLabel={copy.save}
        discardLabel={settingsCopy.general.discard}
        onSave={handleSave}
        onDiscard={() => setSettings(saved)}
        saving={saving}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle(store)}
        back={SETTINGS_BACK}
        save={{ dirty, saving, onSave: handleSave, label: copy.save }}
      />
      <McpStatusCard
        connected={live}
        lastRequestAt={overview.lastRequestAt}
        serverUrl={serverUrl}
      />
      <SettingsDrill rows={rows} backLabel={copy.title}>
        <SettingsDrillPanel id="connect">
          <McpConnectGuide serverUrl={serverUrl} onCreateToken={() => setCreating(true)} />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="apps">
          <McpConnectedApps apps={apps} onDisconnect={setRevoking} />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="permissions">
          <McpPermissionsCard settings={settings} onSettings={setSettings} />
        </SettingsDrillPanel>
        <SettingsDrillPanel id="tokens">
          <McpTokensCard
            tokens={grants.tokens}
            onCreate={() => setCreating(true)}
            onRevoke={setRevoking}
          />
        </SettingsDrillPanel>
      </SettingsDrill>
      <SettingsList>
        <li>
          <SettingsLinkRow
            href={routes.settings.mcp('activity')}
            title={copy.activity.heading}
            description={copy.activity.help}
            value={m.activityValue}
          />
        </li>
      </SettingsList>

      <CreateTokenDialog open={creating} onOpenChange={setCreating} serverUrl={serverUrl} />
      <RevokeGrantDialog grant={revoking} storeName={store} onClose={() => setRevoking(null)} />
    </div>
  )
}
