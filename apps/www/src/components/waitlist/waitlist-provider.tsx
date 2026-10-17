'use client'

import { type ReactNode, useState } from 'react'
import { WaitlistContext, type WaitlistPrefill } from './waitlist-context'
import WaitlistModal from './waitlist-modal'

type WaitlistProviderProps = { children: ReactNode }

export default function WaitlistProvider({ children }: WaitlistProviderProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [prefill, setPrefill] = useState<WaitlistPrefill>({})
  const [session, setSession] = useState(0)

  // Event handlers
  const openWaitlist = (start?: WaitlistPrefill | string) => {
    setPrefill(typeof start === 'string' ? { email: start } : (start ?? {}))
    setSession((n) => n + 1)
    setOpen(true)
  }

  return (
    <WaitlistContext.Provider value={{ openWaitlist }}>
      {children}
      <WaitlistModal
        key={session}
        open={open}
        onOpenChange={setOpen}
        initialEmail={prefill.email ?? ''}
        initialSell={prefill.sell ?? ''}
      />
    </WaitlistContext.Provider>
  )
}
