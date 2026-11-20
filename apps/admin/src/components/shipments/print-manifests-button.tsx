'use client'

import { Printer } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { manifestSheetContent } from '@/data/manifest-sheet'
import { useCopy } from '@/hooks/use-copy'
import { useManifestSheet } from './use-manifest-sheet'

type PrintManifestsButtonProps = {
  /** Only this courier's pickups (a courier app's Shipments page). */
  provider?: string | undefined
}

/**
 * Shipments › To be picked up, beside the tabs: prints one manifest page per pickup for every
 * parcel waiting in the tab, for staff to hand the courier's pickup executive.
 */
export default function PrintManifestsButton({ provider }: PrintManifestsButtonProps) {
  // Hooks
  const copy = useCopy(manifestSheetContent)
  const sheet = useManifestSheet()

  // Event handlers
  const handlePrint = () => {
    void sheet.print(provider ? { provider } : {})
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={sheet.printing}
      title={copy.printAllHint}
      onClick={handlePrint}
    >
      <Printer aria-hidden />
      {copy.printAll}
    </Button>
  )
}
