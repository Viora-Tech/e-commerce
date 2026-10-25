'use client'

import type { ApiGrantView, McpOverview } from '@commerce/core'
import type { McpSettings } from '@commerce/core/api-access'
import { ArrowRight } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import { mcpContent } from '@/data/mcp'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
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
 * Settings → MCP & API, one page: status, the connect guide, connected apps, permissions and
 * approvals, API tokens, and a link to the activity log.
 */
export default function McpPage({ overview, grants, serverUrl }: McpPageProps) {
  // Hooks
  const copy = useCopy(mcpContent)
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
      <McpConnectGuide serverUrl={serverUrl} onCreateToken={() => setCreating(true)} />
      <McpConnectedApps apps={apps} settings={saved} onDisconnect={setRevoking} />
      <McpPermissionsCard settings={settings} onSettings={setSettings} />
      <McpTokensCard
        tokens={grants.tokens}
        onCreate={() => setCreating(true)}
        onRevoke={setRevoking}
      />
      <SettingsCard bodyClassName="flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ink-strong">
            {copy.activity.heading}
          </h2>
          <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
            {copy.activity.help}
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.settings.mcp('activity')} />}
        >
          {copy.activity.open}
          <ArrowRight aria-hidden="true" />
        </Button>
      </SettingsCard>

      <CreateTokenDialog open={creating} onOpenChange={setCreating} serverUrl={serverUrl} />
      <RevokeGrantDialog grant={revoking} storeName={store} onClose={() => setRevoking(null)} />
    </div>
  )
}
