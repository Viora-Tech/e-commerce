'use client'

import type { BillingInterval, PlanId } from '@commerce/core/billing'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { billingContent } from '@/data/billing'
import { useCopy } from '@/hooks/use-copy'
import PlanChooser from './plan-chooser'

type ComparePlansDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: PlanId
  currentInterval: BillingInterval
  paid: boolean
  busy: PlanId | null
  onChoose: (plan: PlanId, interval: BillingInterval) => void
}

/** The plans in a popup, for the trial banner's "Pick a plan"; Change plan is a page now. */
export default function ComparePlansDialog({
  open,
  onOpenChange,
  ...chooser
}: ComparePlansDialogProps) {
  // Hooks
  const copy = useCopy(billingContent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{copy.dialog.title}</DialogTitle>
          <DialogDescription>{copy.dialog.subtitle}</DialogDescription>
        </DialogHeader>
        <PlanChooser {...chooser} />
      </DialogContent>
    </Dialog>
  )
}
