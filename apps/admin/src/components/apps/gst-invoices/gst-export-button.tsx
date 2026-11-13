'use client'

import { Download, ExternalLink } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { gstExportContent } from '@/data/gst-queue-page'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { monthLabel, recentMonths } from './return-months'
import { saveFile } from './save-file'

/**
 * The app bar's "Export GSTR-1" (Figma 928:10728): the portal JSON (Returns › GSTR-1 › Prepare
 * offline › Upload) for last month, the one due for filing, or this month so far, for the main
 * GST number. Other GST numbers and months, the CSVs and GSTR-3B stay on the Returns tab.
 */
export default function GstExportButton() {
  // Hooks
  const copy = useCopy(gstExportContent)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleExport = async (period: string) => {
    setBusy(true)
    try {
      const file = await api.gstInvoices.returns.gstr1Json({ period })
      saveFile(file)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const [thisMonth = '', lastMonth = ''] = recentMonths()

  return (
    <ActionMenu
      label={copy.label}
      trigger="button"
      loading={busy}
      disabled={busy}
      items={[
        {
          label: copy.month(monthLabel(lastMonth)),
          icon: Download,
          onSelect: () => handleExport(lastMonth),
        },
        {
          label: copy.thisMonth(monthLabel(thisMonth)),
          icon: Download,
          onSelect: () => handleExport(thisMonth),
        },
        {
          label: copy.returns,
          icon: ExternalLink,
          href: routes.apps.page('gst-invoices', 'reports'),
          separatorBefore: true,
        },
      ]}
    />
  )
}
