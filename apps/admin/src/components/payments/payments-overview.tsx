'use client'

import { ExternalLink, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import { paymentModesContent } from '@/data/payment-modes'
import { paymentsSetupContent } from '@/data/payments-setup'
import { razorpayWebsitesContent } from '@/data/razorpay-websites'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AddGatewayDialog from './add-gateway-dialog'
import AdvancedSection from './advanced-section'
import HelpFooter from './help-footer'
import MainGatewayCard from './main-gateway-card'
import MethodsList from './methods-list'
import { openTestOrder } from './open-test-order'
import OtherGatewayCard from './other-gateway-card'
import RazorpayWebsiteBanner from './razorpay-website-banner'
import RazorpayWebsiteList from './razorpay-website-list'
import StatusBanner from './status-banner'
import TestModeBar from './test-mode-bar'
import type { CheckoutMethodRow, PaymentsSetup } from './types'
import WhatsThis from './whats-this'

type PaymentsOverviewProps = {
  setup: PaymentsSetup
  onReload: () => Promise<void>
  onOpenGuide: () => void
}

/** The websites card's id, which the "Razorpay is blocking payments" banner links to. */
const WEBSITES_ID = 'razorpay-websites'

/** The one online gateway on at checkout: turning it off leaves COD / bank transfer only. */
function isOnlyOnline(setup: PaymentsSetup, id: string | undefined): boolean {
  const on = setup.gateways.filter((g) => g.connected)
  return on.length === 1 && on[0]?.id === id
}

/**
 * Settings → Payments for a shop that has set up (or skipped the guide):
 * status, the main way to get paid and its health, the ways shoppers can pay,
 * other payment companies, and Advanced.
 */
export default function PaymentsOverview({ setup, onReload, onOpenGuide }: PaymentsOverviewProps) {
  // Hooks
  const announceSetup = useSetupNext()
  const copy = useCopy(paymentsSetupContent)
  const modes = useCopy(paymentModesContent)
  const sites = useCopy(razorpayWebsitesContent)
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
      void announceSetup('payments')
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
      router.push(routes.apps.connect(id))
      // A just-installed app gets its sidebar link from the server layout.
      router.refresh()
    } catch {
      toast.error(copy.add.installFailed)
    }
  }

  // Render logic
  const hasGateway = setup.primary !== null
  const others = setup.gateways.filter((g) => g.configured && g.id !== setup.primary?.id)
  const razorpay = setup.gateways.some((g) => g.id === 'razorpay' && g.configured)
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
        actions={actions}
        back={SETTINGS_BACK}
      />

      <StatusBanner canTakePayments={setup.canTakePayments} canTakeOnline={setup.canTakeOnline} />
      {setup.testMode ? <TestModeBar /> : null}
      {setup.razorpayWebsiteBlock ? (
        <RazorpayWebsiteBanner
          block={setup.razorpayWebsiteBlock}
          websites={setup.razorpayWebsites}
          listId={WEBSITES_ID}
        />
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby="payments-main">
        <h2 id="payments-main" className="text-card font-semibold text-foreground">
          {copy.main.heading}
        </h2>
        <MainGatewayCard
          primary={setup.primary}
          gateway={setup.gateways.find((g) => g.id === setup.primary?.id)}
          onlyOnline={isOnlyOnline(setup, setup.primary?.id)}
          onAdd={handleOpenAdd}
          onChanged={onReload}
          onTurnOnUpi={handleTurnOnUpi}
        />
      </section>

      {others.length ? (
        <section className="flex flex-col gap-2" aria-labelledby="payments-others">
          <h2 id="payments-others" className="text-card font-semibold text-foreground">
            {modes.others.heading}
          </h2>
          {others.map((g) => (
            <OtherGatewayCard
              key={g.id}
              gateway={g}
              onlyOnline={isOnlyOnline(setup, g.id)}
              onChanged={onReload}
            />
          ))}
        </section>
      ) : null}

      {razorpay || setup.razorpayWebsiteBlock ? (
        <SettingsCard id={WEBSITES_ID} title={sites.list.label} description={sites.list.help}>
          <RazorpayWebsiteList websites={setup.razorpayWebsites} />
        </SettingsCard>
      ) : null}

      <SettingsCard
        id="payments-methods"
        title={copy.methods.heading}
        description={hasGateway ? copy.methods.help : copy.methods.needsGateway}
      >
        <MethodsList
          methods={methods}
          hasGateway={hasGateway}
          disabled={savingMethods}
          onChange={saveMethods}
        />
      </SettingsCard>

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
