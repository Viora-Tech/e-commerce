'use client'

import { quarterOf, type TdsQuarter } from '@commerce/plugin-affiliates/tds'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import ChoiceSelect from './choice-select'

type TdsReportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Saves the CSV in the browser. */
  onDownload: (name: string, csv: string) => void
}

type Quarter = TdsQuarter['quarter']

/** Picks a quarter and downloads the 26Q working file. */
export default function TdsReportDialog({ open, onOpenChange, onDownload }: TdsReportDialogProps) {
  // Hooks
  const { payouts, failed } = useCopy(affiliatesContent)
  const [pick, setPick] = useState(() => quarterOf(new Date()))
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDownload = async () => {
    setBusy(true)
    try {
      const { csv } = await api.affiliates.payouts.tdsReport(pick)
      onDownload(`tds-26q-fy${pick.fy}-q${pick.quarter}.csv`, csv)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorText(err, failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const copy = payouts.tdsDialog
  const latest = quarterOf(new Date()).fy
  const years = [latest, latest - 1, latest - 2]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent busy={busy}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-tds-fy">{copy.fy}</Label>
            <ChoiceSelect
              id="aff-tds-fy"
              value={String(pick.fy)}
              options={years.map((y) => ({ value: String(y), label: copy.fyLabel(y) }))}
              onChange={(fy) => setPick({ ...pick, fy: Number(fy) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-tds-quarter">{copy.quarter}</Label>
            <ChoiceSelect
              id="aff-tds-quarter"
              value={String(pick.quarter)}
              options={copy.quarters.map((label, i) => ({ value: String(i + 1), label }))}
              onChange={(q) => setPick({ ...pick, quarter: Number(q) as Quarter })}
            />
          </div>
        </div>
        <p className="text-caption text-muted-foreground">{copy.note}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button loading={busy} onClick={handleDownload} disabled={busy}>
            {copy.download}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
