'use client'

import { Download, ExternalLink } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { gstExportContent } from '@/data/gst-queue-page'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import { monthLabel, recentMonths } from './return-months'
import { saveFile } from './save-file'

/**
 * "Export GSTR-1" (Figma 928:10728), in the app bar and in the Queue page's own header: the
 * portal JSON (Returns › GSTR-1 › Prepare offline › Upload) for last month, the one due for filing, or this month so far, for the main
 * GST number, and the CA's sales register (Excel) for the same months. Other GST numbers and
 * months, the CSVs and GSTR-3B stay on the Returns tab.
 */
export default function GstExportButton() {
  // Hooks
  const copy = useCopy(gstExportContent)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleExport = async (period: string, kind: 'gstr1' | 'register' = 'gstr1') => {
    setBusy(true)
    try {
      const file =
        kind === 'register'
          ? await api.gstInvoices.returns.salesRegister({ period })
          : await api.gstInvoices.returns.gstr1Json({ period })
      saveFile(file)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
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
      // The ⋯ menu always follows it (app bar and Queue header): 1rem between the two with the
      // row's 0.5rem gap, so ⋯ does not read as part of Export (owner, 28 Nov 2026).
      triggerClassName="mr-2"
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
          label: copy.register(monthLabel(lastMonth)),
          icon: Download,
          onSelect: () => handleExport(lastMonth, 'register'),
          separatorBefore: true,
        },
        {
          label: copy.register(monthLabel(thisMonth)),
          icon: Download,
          onSelect: () => handleExport(thisMonth, 'register'),
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
