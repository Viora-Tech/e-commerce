'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: useManifestSheet, print pickup manifest
 * WHAT:  prints the pickup manifest PDF (`shipments.manifestSheet`) for the ticked parcels, or
 *        for every parcel in To be picked up, in a new tab.
 * WHY:   staff hand the courier's pickup executive a list to sign. The server reuses the
 *        manifest made with the pickup when it holds exactly those parcels, else records one.
 * WHERE: Shipments › To be picked up: the selection bar (`shipments-bulk-actions.tsx`) and the
 *        tab's "Print all manifests" (`print-manifests-button.tsx`).
 */
import { MANIFEST_SHEET_MAX } from '@commerce/core/manifest-sheet'
import { useState } from 'react'
import { toast } from 'sonner'
import { manifestSheetContent } from '@/data/manifest-sheet'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { showFile } from './show-file'

export function useManifestSheet() {
  const copy = useCopy(manifestSheetContent)
  const [printing, setPrinting] = useState(false)

  /** `shipmentIds` left out: every parcel in To be picked up (optionally one courier's). */
  const print = async (input: { shipmentIds?: string[]; provider?: string }) => {
    if (printing) return
    if (input.shipmentIds && input.shipmentIds.length > MANIFEST_SHEET_MAX) {
      toast.error(copy.tooMany(MANIFEST_SHEET_MAX))
      return
    }
    // Opened during the click, so the browser lets it through; the file lands in it when ready.
    const tab = window.open('', '_blank')
    if (tab) {
      tab.document.title = copy.making
      tab.document.body.textContent = copy.making
    }
    setPrinting(true)
    try {
      const res = await api.shipments.manifestSheet(input)
      showFile(res.file, tab)
      toast.success(copy.done(res.shipments, res.manifests))
    } catch (err) {
      tab?.close()
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setPrinting(false)
    }
  }

  return { printing, print }
}
