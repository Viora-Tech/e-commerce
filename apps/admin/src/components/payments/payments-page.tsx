'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PaymentsOverview from './payments-overview'
import SetupWizard from './setup-wizard'
import type { PaymentsSetup } from './types'

type View = 'guide' | 'page'

/**
 * Settings → Payments. A shop that has never connected a way to get paid (and
 * didn't skip) gets the one-question-per-screen guide; everyone else the page.
 * The choice is made once per visit so reloading mid-guide doesn't jump away.
 */
export default function PaymentsPage() {
  // Hooks
  const copy = useCopy(paymentsSetupContent)
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [setup, setSetup] = useState<PaymentsSetup | null>(null)
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    api.payments.setup().then((s) => {
      setSetup(s)
      // `?view=page` opens the full page without skipping the guide (nothing is saved).
      const forcePage = new URLSearchParams(window.location.search).get('view') === 'page'
      setView((v) => v ?? (s.showSetup && !forcePage ? 'guide' : 'page'))
    })
  }, [])

  // Back from "Connect Razorpay": say how it went, then drop the query.
  useEffect(() => {
    const result = params.get('connect')
    if (!result) return
    const message = copy.connect.oauthResult[result]
    if (message) {
      if (result === 'razorpay' || result === 'razorpay-webhook') toast.success(message)
      else toast.error(message)
    }
    router.replace(pathname)
  }, [params, pathname, router, copy])

  // Helpers
  const reload = async () => {
    setSetup(await api.payments.setup())
  }

  // Event handlers
  const handleDone = async () => {
    await reload()
    setView('page')
  }

  const handleOpenGuide = () => setView('guide')

  // Early returns
  if (!setup || !view) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    )
  }

  return view === 'guide' ? (
    <SetupWizard setup={setup} onReload={reload} onDone={handleDone} />
  ) : (
    <PaymentsOverview setup={setup} onReload={reload} onOpenGuide={handleOpenGuide} />
  )
}
