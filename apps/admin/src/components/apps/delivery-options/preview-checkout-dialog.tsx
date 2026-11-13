'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import CheckoutPreviewList from './checkout-preview-list'
import { PREVIEW_CART, PREVIEW_PIN, useCheckoutPreview } from './use-checkout-preview'

type PreviewCheckoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The app bar's "Preview checkout": the cards a shopper at a PIN sees now, saved settings. */
export default function PreviewCheckoutDialog({ open, onOpenChange }: PreviewCheckoutDialogProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const [typed, setTyped] = useState(PREVIEW_PIN)
  const [pincode, setPincode] = useState(PREVIEW_PIN)
  const preview = useCheckoutPreview(null, pincode)

  // Event handlers
  const handleShow = () => {
    if (/^[1-9]\d{5}$/.test(typed.trim())) setPincode(typed.trim())
  }

  // Render logic
  const h = pages.header
  const kg = String(PREVIEW_CART.weightGrams / 1000)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pages.preview.previewTitle}</DialogTitle>
          <DialogDescription>{h.previewHelp}</DialogDescription>
        </DialogHeader>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleShow()
          }}
        >
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="preview-checkout-pin" className="text-caption text-muted-foreground">
              {h.pin}
            </label>
            <Input
              id="preview-checkout-pin"
              value={typed}
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            {h.show}
          </Button>
        </form>
        <p className="text-caption text-muted-foreground">
          {pages.preview.previewFor(pincode, kg)}
        </p>
        <CheckoutPreviewList {...preview} />
      </DialogContent>
    </Dialog>
  )
}
