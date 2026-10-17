'use client'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { waitlistContent as copy } from '@/data/waitlist'
import WaitlistForm from './waitlist-form'
import WaitlistSuccess from './waitlist-success'

type WaitlistModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEmail: string
}

export default function WaitlistModal({ open, onOpenChange, initialEmail }: WaitlistModalProps) {
  // Hooks
  const router = useRouter()
  const [joined, setJoined] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    // Closing after success routes to the thank-you page, so the state survives a refresh.
    if (!next && joined) router.push('/waitlist/thanks')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92svh] gap-0 overflow-y-auto p-6 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none md:max-w-md"
      >
        {joined ? (
          <WaitlistSuccess onDone={() => handleOpenChange(false)} />
        ) : (
          <>
            <DialogTitle className="text-xl font-semibold text-foreground">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="mt-1 mb-5 text-muted-foreground">
              {copy.intro}
            </DialogDescription>
            <WaitlistForm initialEmail={initialEmail} onJoined={() => setJoined(true)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
