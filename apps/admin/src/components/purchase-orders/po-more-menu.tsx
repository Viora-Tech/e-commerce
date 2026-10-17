'use client'

import { Download, Printer, Send } from '@commerce/ui/icons'
import ActionMenu from '@/components/layout/action-menu'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'

type PoMoreMenuProps = {
  busy: boolean
  onPrint: () => void
  onDownload: () => void
  onEmail: () => void
}

/** The "…" menu on a saved purchase order: print, download or email its PDF. */
export default function PoMoreMenu({ busy, onPrint, onDownload, onEmail }: PoMoreMenuProps) {
  // Hooks
  const copy = useCopy(purchaseOrderFormContent)

  return (
    <ActionMenu
      label={copy.more}
      variant="outline"
      size="md"
      disabled={busy}
      items={[
        { label: copy.print, icon: Printer, onSelect: onPrint },
        { label: copy.download, icon: Download, onSelect: onDownload },
        { label: copy.emailSupplier, icon: Send, onSelect: onEmail },
      ]}
    />
  )
}
