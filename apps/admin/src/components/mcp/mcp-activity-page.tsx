'use client'

import { Download } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'
import { routes } from '@/lib/routes'
import McpActivityTab from './mcp-activity'

type McpActivityPageProps = {
  store: { name: string; slug: string }
}

/** Settings → MCP & API → Activity: the 90-day log, with Export CSV. */
export default function McpActivityPage({ store }: McpActivityPageProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const [exporting, setExporting] = useState(false)

  // Event handlers
  const handleExport = async () => {
    setExporting(true)
    try {
      downloadCsv(`mcp-activity-${store.slug}.csv`, await api.apiAccess.activityCsv())
    } catch {
      toast.error(copy.activity.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.activity.title}
        subtitle={copy.activity.subtitle(store.name)}
        back={{ label: copy.activity.back, href: routes.settings.mcp() }}
        actions={
          <Button variant="outline" onClick={handleExport} loading={exporting}>
            <Download aria-hidden="true" />
            {copy.activity.export}
          </Button>
        }
      />
      <McpActivityTab />
    </div>
  )
}
