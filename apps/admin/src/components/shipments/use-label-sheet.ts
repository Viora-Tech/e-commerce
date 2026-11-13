'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: useLabelSheet, label paper choice
 * WHAT:  prints a batch's labels as one PDF in the paper the member picked (4 × 6 thermal,
 *        A4 four-up, or each courier's own size) and remembers that paper.
 * WHY:   one file and one print dialog instead of a tab per courier label (Figma 909:9249).
 *        The paper is kept in this member's browser for this store (`scopedStorageKey`), not
 *        as a store setting: it follows the printer on the desk, two packers on two printers
 *        can differ, and it needs no schema or settings form.
 * WHERE: the bulk result's Print card and Shipments › Booked's "Print labels".
 */
import {
  DEFAULT_LABEL_SHEET_FORMAT,
  isLabelSheetFormat,
  LABEL_SHEET_MAX,
  type LabelSheetFormat,
} from '@commerce/core/label-sheet-layout'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { labelSheetContent } from '@/data/label-sheet'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { useScopedStorageKey } from '@/lib/storage-scope'

const STORAGE_KEY = 'shipments.label-paper:v1'

function readFormat(key: string | null): LabelSheetFormat {
  if (!key) return DEFAULT_LABEL_SHEET_FORMAT
  try {
    const saved = window.localStorage.getItem(key)
    return isLabelSheetFormat(saved) ? saved : DEFAULT_LABEL_SHEET_FORMAT
  } catch {
    return DEFAULT_LABEL_SHEET_FORMAT
  }
}

function writeFormat(key: string | null, format: LabelSheetFormat) {
  if (!key) return
  try {
    window.localStorage.setItem(key, format)
  } catch {
    // Storage blocked: the choice lasts this visit only.
  }
}

/** Shows the file in the tab opened on click, else saves it (a blocked pop-up). */
function showFile(file: File, tab: Window | null) {
  const url = URL.createObjectURL(file)
  if (tab && !tab.closed) {
    tab.location.href = url
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function useLabelSheet() {
  const copy = useCopy(labelSheetContent)
  const key = useScopedStorageKey(STORAGE_KEY)
  const [format, setFormatState] = useState<LabelSheetFormat>(DEFAULT_LABEL_SHEET_FORMAT)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    setFormatState(readFormat(key))
  }, [key])

  const setFormat = (next: LabelSheetFormat) => {
    setFormatState(next)
    writeFormat(key, next)
  }

  const print = async (ids: string[]) => {
    if (ids.length === 0 || printing) return
    if (ids.length > LABEL_SHEET_MAX) {
      toast.error(copy.tooMany(LABEL_SHEET_MAX))
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
      const res = await api.shipments.labelSheet({ ids, format })
      if (!res.file) {
        tab?.close()
        toast.error(copy.noneReady)
        return
      }
      showFile(res.file, tab)
      if (res.skipped.length > 0) {
        const list = res.skipped
          .map((s) =>
            s.orderNumber === null
              ? copy.reasons[s.reason]
              : `#${s.orderNumber} ${copy.reasons[s.reason]}`,
          )
          .join(', ')
        toast.warning(copy.leftOut(res.skipped.length, list))
      }
    } catch (err) {
      tab?.close()
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setPrinting(false)
    }
  }

  return { format, setFormat, printing, print }
}
