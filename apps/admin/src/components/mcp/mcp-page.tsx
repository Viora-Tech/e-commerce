'use client'

import type { ApiGrantView, McpOverview } from '@commerce/core'
import type { McpClientId, McpSettings } from '@commerce/core/api-access'
import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SectionTabs, { useActiveSection } from '@/components/settings/section-tabs'
import { mcpContent } from '@/data/mcp'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'
import ConnectClientDialog from './connect-client-dialog'
import McpActivityTab from './mcp-activity'
import McpClientsTab from './mcp-clients'
import McpOverviewTab from './mcp-overview'

type McpPageProps = {
  overview: McpOverview
  grants: { clients: ApiGrantView[]; tokens: ApiGrantView[] }
  serverUrl: string
}

type TabId = 'overview' | 'clients' | 'activity'

/** Renders its children only while its tab is the open one. */
function Tab({ id, children }: { id: TabId; children: ReactNode }) {
  // Hooks
  const active = useActiveSection()

  // Render logic
  return active === null || active === id ? children : null
}

/** Settings → MCP & API (Figma 704:110463): Overview, Clients & tokens, Activity log. */
export default function McpPage({ overview, grants, serverUrl }: McpPageProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const settingsCopy = useCopy(settingsContent)
  const router = useRouter()
  const [tab] = useQueryState('tab', { defaultValue: 'overview' })
  const [settings, setSettings] = useState<McpSettings>(overview.settings)
  const [saved, setSaved] = useState<McpSettings>(overview.settings)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState<McpClientId | null>(null)
  const [exporting, setExporting] = useState(false)

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

  const handleExport = async () => {
    setExporting(true)
    try {
      downloadCsv(`mcp-activity-${overview.store.slug}.csv`, await api.apiAccess.activityCsv())
    } catch {
      toast.error(copy.activity.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  // Render logic
  const store = overview.store.name
  const current: TabId = tab === 'clients' || tab === 'activity' ? tab : 'overview'
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved)

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
        subtitle={copy.subtitles[current](store)}
        back={SETTINGS_BACK}
        save={
          current === 'overview'
            ? { dirty, saving, onSave: handleSave, label: copy.save }
            : undefined
        }
        actions={
          current === 'activity' ? (
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              <Download aria-hidden="true" />
              {copy.activity.export}
            </Button>
          ) : undefined
        }
      />
      <SectionTabs
        tabs={[
          { id: 'overview', label: copy.tabs.overview },
          { id: 'clients', label: copy.tabs.clients },
          { id: 'activity', label: copy.tabs.activity },
        ]}
      >
        <Tab id="overview">
          <McpOverviewTab
            overview={overview}
            serverUrl={serverUrl}
            settings={settings}
            onSettings={setSettings}
            onConnect={setConnecting}
          />
        </Tab>
        <Tab id="clients">
          <McpClientsTab
            clients={grants.clients}
            tokens={grants.tokens}
            settings={saved}
            storeName={store}
            onConnect={() => setConnecting('claude')}
          />
        </Tab>
        <Tab id="activity">
          <McpActivityTab />
        </Tab>
      </SectionTabs>
      <ConnectClientDialog
        client={connecting}
        serverUrl={serverUrl}
        storeName={store}
        onClose={() => setConnecting(null)}
      />
    </div>
  )
}
