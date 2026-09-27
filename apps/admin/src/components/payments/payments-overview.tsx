'use client'

import { CreditCard, ExternalLink, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { paymentsSetupContent as copy } from '@/data/payments-setup'
import { api } from '@/lib/api-client'
import AddGatewayDialog from './add-gateway-dialog'
import AdvancedSection from './advanced-section'
import HelpFooter from './help-footer'
import MainGatewayCard from './main-gateway-card'
import MethodsList from './methods-list'
import { openTestOrder } from './open-test-order'
import StatusBanner from './status-banner'
import type { CheckoutMethodRow, PaymentsSetup } from './types'
import WhatsThis from './whats-this'

type PaymentsOverviewProps = {
  setup: PaymentsSetup
  onReload: () => Promise<void>
  onOpenGuide: () => void
}

/**
 * Settings → Payments for a shop that has set up (or skipped the guide):
 * status, the main way to get paid and its health, the ways shoppers can pay,
 * other payment companies, and Advanced.
 */
export default function PaymentsOverview({ setup, onReload, onOpenGuide }: PaymentsOverviewProps) {
  // Hooks
  const router = useRouter()
  const [methods, setMethods] = useState<CheckoutMethodRow[]>(setup.methods)
  const [savingMethods, setSavingMethods] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [opening, setOpening] = useState(false)

  // Helpers
  const saveMethods = async (next: CheckoutMethodRow[]) => {
    const before = methods
    setMethods(next)
    setSavingMethods(true)
    try {
      await api.payments.saveMethods({ methods: next })
      toast.success(copy.methods.saved)
      await onReload()
    } catch {
      setMethods(before)
      toast.error(copy.methods.saveFailed)
    } finally {
      setSavingMethods(false)
    }
  }

  // Event handlers
  const handleTestOrder = async () => {
    setOpening(true)
    if (!(await openTestOrder())) toast.error(copy.testOrderFailed)
    setOpening(false)
  }

  const handleTurnOnUpi = () =>
    saveMethods(methods.map((m) => (m.id === 'upi' ? { ...m, on: true } : m)))

  const handleOpenAdd = () => setAddOpen(true)

  const handleConnect = async (id: string) => {
    try {
      if (!setup.gateways.find((g) => g.id === id)?.installed) await api.apps.install({ id })
      router.push(`/apps/${id}/connect`)
      // A just-installed app gets its sidebar link from the server layout.
      router.refresh()
    } catch {
      toast.error(copy.add.installFailed)
    }
  }

  // Render logic
  const hasGateway = setup.primary !== null
  const actions = (
    <Button variant="outline" className="gap-1.5" onClick={handleTestOrder} disabled={opening}>
      {opening ? <Spinner /> : null}
      {copy.testOrder}
      <ExternalLink aria-hidden="true" className="size-3.5" />
    </Button>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {copy.intro}
            <WhatsThis />
          </span>
        }
        icon={<CreditCard aria-hidden="true" />}
        actions={actions}
      />

      <StatusBanner canTakePayments={setup.canTakePayments} canTakeOnline={setup.canTakeOnline} />

      <section className="flex flex-col gap-2" aria-labelledby="payments-main">
        <h2 id="payments-main" className="text-card font-semibold text-foreground">
          {copy.main.heading}
        </h2>
        <MainGatewayCard
          primary={setup.primary}
          onAdd={handleOpenAdd}
          onChanged={onReload}
          onTurnOnUpi={handleTurnOnUpi}
        />
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="payments-methods">
        <h2 id="payments-methods" className="text-card font-semibold text-foreground">
          {copy.methods.heading}
        </h2>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-body text-muted-foreground">
              {hasGateway ? copy.methods.help : copy.methods.needsGateway}
            </p>
            <MethodsList
              methods={methods}
              hasGateway={hasGateway}
              disabled={savingMethods}
              onChange={saveMethods}
            />
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" className="gap-1.5" onClick={handleOpenAdd}>
          <Plus aria-hidden="true" className="size-4" />
          {copy.add.button}
        </Button>
        {hasGateway ? null : (
          <Button variant="ghost" size="lg" onClick={onOpenGuide}>
            {copy.openGuide}
          </Button>
        )}
      </div>

      <AdvancedSection />
      <HelpFooter />

      <AddGatewayDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        gateways={setup.gateways}
        onConnect={handleConnect}
      />
    </div>
  )
}
