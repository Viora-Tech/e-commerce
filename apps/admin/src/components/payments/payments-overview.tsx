'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import SettingsDrill from '@/components/settings/settings-drill'
import SettingsDrillPanel from '@/components/settings/settings-drill-panel'
import { paymentRulesContent } from '@/data/payment-rules'
import { methodNames, paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ActiveProvidersCard from './active-providers-card'
import AddGatewayDialog from './add-gateway-dialog'
import AdvancedSection from './advanced-section'
import CodSettingsSection from './cod-settings-section'
import ConfigSection from './config-section'
import HelpFooter from './help-footer'
import ManualMethodsCard from './manual-methods-card'
import ManualSection from './manual-section'
import MethodsList from './methods-list'
import { openTestOrder } from './open-test-order'
import PaymentCaptureCard from './payment-capture-card'
import PaymentRulesCard from './payment-rules-card'
import { PAYMENT_ROWS, paymentRows } from './payments-rows'
import ProvidersSection from './providers-section'
import RazorpayWebsiteBanner from './razorpay-website-banner'
import RouteMethodsCard from './route-methods-card'
import StatusBanner from './status-banner'
import TestModeBar from './test-mode-bar'
import type { CheckoutMethodRow, PaymentsSetup } from './types'
import WhatsThis from './whats-this'

type PaymentsOverviewProps = {
  setup: PaymentsSetup
  onReload: () => Promise<void>
  onOpenGuide: () => void
}

/** The Razorpay page's websites card, which the "Razorpay is blocking payments" banner links to. */
const WEBSITES_HREF = `${routes.settings.paymentProvider('razorpay')}#razorpay-websites`

/**
 * Settings → Payments for a shop that has set up (or skipped the guide), Shopify-style: the
 * status banners over three sections: payment providers (each row opens the provider's page),
 * manual payment methods, and payment configuration (capture, customizations, supported
 * methods, More), whose rows open their detail in place (`?open=`, old `#anchors` too;
 * `payments-rows.ts`).
 */
export default function PaymentsOverview({ setup, onReload, onOpenGuide }: PaymentsOverviewProps) {
  // Hooks
  const announceSetup = useSetupNext()
  const copy = useCopy(paymentsSetupContent)
  const { page } = useCopy(paymentRulesContent)
  const names = useCopy(methodNames)
  const router = useRouter()
  const [methods, setMethods] = useState<CheckoutMethodRow[]>(setup.methods)
  const [savingMethods, setSavingMethods] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [confirmingCodOff, setConfirmingCodOff] = useState(false)

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

  const handleOpenAdd = () => setAddOpen(true)

  const saveCod = (on: boolean) =>
    saveMethods(methods.map((m) => (m.id === 'cod' ? { ...m, on } : m)))

  // #90: switching off the last way to pay asks first, since checkout then takes no orders.
  const handleCod = (on: boolean) => {
    const lastWay =
      !setup.canTakeOnline && !setup.manualMethods.upi.on && !setup.manualMethods.bank.on
    if (!on && lastWay) setConfirmingCodOff(true)
    else void saveCod(on)
  }

  const handleCodOff = () => {
    setConfirmingCodOff(false)
    void saveCod(false)
  }

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
  // Several gateways together (audit #148/#150): only worth showing with two to choose from.
  const routable = setup.routing.gateways.length > 1
  const activeCount = setup.routing.gateways.filter((g) => g.active).length
  const codOn = methods.some((m) => m.id === 'cod' && m.on)
  // `?open=providers` (the settings search) lands on the providers section unless there is an order to set.
  const rows = paymentRows(setup, methods, page, names).filter(
    (r) => routable || r.id !== PAYMENT_ROWS.providers,
  )
  const home = (
    <>
      <ProvidersSection
        setup={setup}
        showOrder={routable}
        onAdd={handleOpenAdd}
        onOpenGuide={onOpenGuide}
      />
      <ManualSection setup={setup} codOn={codOn} onReload={onReload} />
      <ConfigSection rows={rows} />
    </>
  )
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
      />

      <StatusBanner canTakePayments={setup.canTakePayments} canTakeOnline={setup.canTakeOnline} />
      {setup.testMode ? <TestModeBar /> : null}
      {setup.razorpayWebsiteBlock ? (
        <RazorpayWebsiteBanner
          block={setup.razorpayWebsiteBlock}
          websites={setup.razorpayWebsites}
          listHref={WEBSITES_HREF}
        />
      ) : null}

      <SettingsDrill rows={rows} backLabel={page.back} home={home}>
        <SettingsDrillPanel id={PAYMENT_ROWS.providers}>
          <ActiveProvidersCard
            key={JSON.stringify(setup.routing.gateways)}
            setup={setup}
            onReload={onReload}
          />
          <CodSettingsSection codOn={codOn} />
        </SettingsDrillPanel>

        <SettingsDrillPanel id={PAYMENT_ROWS.methods}>
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
          {routable && activeCount > 1 ? (
            <RouteMethodsCard
              key={JSON.stringify(setup.routing.methods)}
              setup={setup}
              methods={methods}
              onReload={onReload}
            />
          ) : null}
        </SettingsDrillPanel>

        <SettingsDrillPanel id={PAYMENT_ROWS.manual}>
          <ManualMethodsCard
            setup={setup}
            codOn={codOn}
            disabled={savingMethods}
            onCodChange={handleCod}
            onReload={onReload}
          />
          <CodSettingsSection codOn={codOn} />
        </SettingsDrillPanel>

        <SettingsDrillPanel id={PAYMENT_ROWS.capture}>
          <PaymentCaptureCard setup={setup} onReload={onReload} />
        </SettingsDrillPanel>

        <SettingsDrillPanel id={PAYMENT_ROWS.rules}>
          <PaymentRulesCard setup={setup} onReload={onReload} />
        </SettingsDrillPanel>

        <SettingsDrillPanel id={PAYMENT_ROWS.more}>
          <AdvancedSection />
        </SettingsDrillPanel>
      </SettingsDrill>

      <HelpFooter page="payments" />

      <AddGatewayDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        gateways={setup.gateways}
        onConnect={handleConnect}
      />
      <ConfirmDialog
        open={confirmingCodOff}
        onOpenChange={setConfirmingCodOff}
        title={copy.methods.lastWayTitle}
        body={copy.methods.lastWayBody}
        confirmLabel={copy.methods.lastWayConfirm}
        cancelLabel={copy.methods.lastWayCancel}
        onConfirm={handleCodOff}
      />
    </div>
  )
}
