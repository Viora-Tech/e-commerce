'use client'

import { Download, MoreHorizontal, Printer, Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" aria-label={copy.more} disabled={busy} />}
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={onPrint} disabled={busy}>
          <Printer aria-hidden="true" /> {copy.print}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload} disabled={busy}>
          <Download aria-hidden="true" /> {copy.download}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEmail} disabled={busy}>
          <Send aria-hidden="true" /> {copy.emailSupplier}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
