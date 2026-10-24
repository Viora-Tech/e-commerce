'use client'

import { quarterOf, type TdsQuarter } from '@commerce/plugin-affiliates/tds'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Label } from '@commerce/ui/shadcn/label'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import { toast } from 'sonner'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

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
      toast.error(err instanceof Error ? err.message : failed)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-tds-fy">{copy.fy}</Label>
            <NativeSelect
              id="aff-tds-fy"
              value={String(pick.fy)}
              onChange={(e) => setPick({ ...pick, fy: Number(e.target.value) })}
            >
              {years.map((y) => (
                <NativeSelectOption key={y} value={String(y)}>
                  {copy.fyLabel(y)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-tds-quarter">{copy.quarter}</Label>
            <NativeSelect
              id="aff-tds-quarter"
              value={String(pick.quarter)}
              onChange={(e) => setPick({ ...pick, quarter: Number(e.target.value) as Quarter })}
            >
              {copy.quarters.map((label, i) => (
                <NativeSelectOption key={label} value={String(i + 1)}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <p className="text-caption text-muted-foreground">{copy.note}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleDownload} disabled={busy}>
            {copy.download}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
