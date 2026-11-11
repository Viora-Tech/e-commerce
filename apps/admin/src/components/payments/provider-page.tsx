'use client'

import { CircleCheck, Pause, PlugConnect, StarIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import BackLink from '@/components/layout/back-link'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { paymentModesContent } from '@/data/payment-modes'
import { paymentProvidersContent } from '@/data/payment-providers'
import { gatewayCatalogue, PAYMENTS_PAGE_HREF, paymentsSetupContent } from '@/data/payments-setup'
import { razorpayWebsitesContent } from '@/data/razorpay-websites'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import GatewayLogo from './gateway-logo'
import GatewayModeSwitch from './gateway-mode-switch'
import PaymentCaptureCard from './payment-capture-card'
import ProviderAboutCard from './provider-about-card'
import ProviderMethodsCard from './provider-methods-card'
import { mainProviderId, providerStatus } from './provider-status'
import ProviderStatusChip from './provider-status-chip'
import RazorpayWebsiteList from './razorpay-website-list'
import TestModeBar from './test-mode-bar'
import { type GatewayApp, isGatewayId, isModeGateway, type PaymentsSetup, routesFor } from './types'
import { useGatewayActive } from './use-gateway-active'

type ProviderPageProps = {
  providerId: string
}

/** The websites card's id, which the "Razorpay is blocking payments" banner links to. */
const WEBSITES_ID = 'razorpay-websites'

const monogramOf = (id: string) =>
  gatewayCatalogue.find((g) => g.id === id)?.monogram ?? id.slice(0, 2)

/**
 * One payment provider's page (Settings → Payments → Razorpay), Shopify style: its name and
 * status with Manage keys and More actions (make main, deactivate), then About, Live/Test,
 * payment capture, the ways to pay it takes and, for Razorpay, the websites it must allow.
 */
export default function ProviderPage({ providerId }: ProviderPageProps) {
  // Hooks
  const copy = useCopy(paymentProvidersContent)
  const setupCopy = useCopy(paymentsSetupContent)
  const catalogue = useCopy(gatewayCatalogue)
  const sites = useCopy(razorpayWebsitesContent)
  const [setup, setSetup] = useState<PaymentsSetup | null>(null)

  useEffect(() => {
    api.payments.setup().then((s) => {
      setSetup(s)
      // An `#anchor` (the websites card) only exists once the page has loaded.
      const hash = window.location.hash.slice(1)
      if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView())
    })
  }, [])

  // Helpers
  const reload = async () => {
    setSetup(await api.payments.setup())
  }

  // Early returns
  if (!setup) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Card gap={4} inset={6}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    )
  }

  const gateway = setup.gateways.find((g) => g.id === providerId)
  const entry = catalogue.find((g) => g.id === providerId)
  if (!gateway) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={PAYMENTS_PAGE_HREF} label={setupCopy.backToPayments} />
        <p className="text-body text-muted-foreground">{copy.provider.notFound}</p>
      </div>
    )
  }

  // Render logic
  const back = { label: setupCopy.backToPayments, href: PAYMENTS_PAGE_HREF }
  const lead = {
    kind: 'logo' as const,
    node: <GatewayLogo id={gateway.id} monogram={monogramOf(gateway.id)} size="lg" />,
  }

  if (!gateway.configured) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={gateway.name}
          back={back}
          lead={lead}
          badges={<StatusChip tone="neutral">{copy.provider.notConnected}</StatusChip>}
        />
        <Card>
          <CardContent className="flex flex-col gap-3">
            {entry ? <p className="text-body text-foreground">{entry.blurb}</p> : null}
            {entry ? <p className="text-body text-muted-foreground">{entry.fees}</p> : null}
            <Button
              className="w-fit self-end"
              nativeButton={false}
              render={<Link href={routes.apps.connect(gateway.id)} />}
            >
              <PlugConnect aria-hidden="true" />
              {setupCopy.main.connect}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const several = setup.routing.gateways.length > 1
  const isMain = several && mainProviderId(setup) === gateway.id

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={gateway.name}
        subtitle={isMain ? copy.provider.mainHelp : undefined}
        back={back}
        lead={lead}
        badges={<ProviderStatusChip status={providerStatus(gateway, setup)} />}
        actions={<ProviderActions setup={setup} gateway={gateway} onChanged={reload} />}
      />

      {gateway.mode === 'test' ? <TestModeBar /> : null}

      <ProviderAboutCard setup={setup} gateway={gateway} onReload={reload} />
      <GatewayModeSwitch gateway={gateway} onChanged={reload} placement="page" />
      <PaymentCaptureCard setup={setup} onReload={reload} gatewayId={gateway.id} />
      <ProviderMethodsCard
        key={JSON.stringify(setup.methods)}
        setup={setup}
        gateway={gateway}
        onReload={reload}
      />
      {gateway.id === 'razorpay' ? (
        <SettingsCard id={WEBSITES_ID} title={sites.list.label} description={sites.list.help}>
          <RazorpayWebsiteList websites={setup.razorpayWebsites} />
        </SettingsCard>
      ) : null}
    </div>
  )
}

type ProviderActionsProps = {
  setup: PaymentsSetup
  gateway: GatewayApp
  onChanged: () => Promise<void>
}

/** The header's Manage keys and More actions (make main provider, deactivate / activate). */
function ProviderActions({ setup, gateway, onChanged }: ProviderActionsProps) {
  // Hooks
  const { provider: copy } = useCopy(paymentProvidersContent)
  const { active: activeCopy } = useCopy(paymentModesContent)
  const { asking, setAsking, busy, deactivate, activate, confirmOff } = useGatewayActive(
    gateway,
    onChanged,
  )
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleMakeMain = async () => {
    if (!isGatewayId(gateway.id)) return
    setSaving(true)
    try {
      const rest = setup.routing.gateways.filter((g) => g.active && g.id !== gateway.id)
      const order = [gateway.id, ...rest.map((g) => g.id)].filter(isGatewayId)
      await api.payments.saveRouting({ order, methods: routesFor(setup.routing.methods, order) })
      toast.success(copy.madeMain(gateway.name))
      await onChanged()
    } catch {
      toast.error(copy.makeMainFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const canMakeMain =
    isGatewayId(gateway.id) &&
    setup.routing.gateways.length > 1 &&
    mainProviderId(setup) !== gateway.id
  const canSwitch = isModeGateway(gateway.id)
  const online = setup.gateways.filter((g) => g.connected)
  const onlyOnline = online.length === 1 && online[0]?.id === gateway.id

  return (
    <>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={routes.apps.connect(gateway.id)} />}
      >
        {copy.manageKeys}
      </Button>
      <ActionMenu
        label={copy.more}
        trigger="button"
        variant="outline"
        loading={saving || busy}
        disabled={!canMakeMain && !canSwitch}
        items={[
          {
            label: copy.makeMain,
            icon: StarIcon,
            onSelect: handleMakeMain,
            hidden: !canMakeMain,
          },
          {
            label: activeCopy.activate(gateway.name),
            icon: CircleCheck,
            onSelect: activate,
            hidden: !canSwitch || gateway.connected,
          },
          {
            label: activeCopy.deactivate(gateway.name),
            icon: Pause,
            destructive: true,
            onSelect: deactivate,
            hidden: !canSwitch || !gateway.connected,
          },
        ]}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={activeCopy.offTitle}
        body={onlyOnline ? `${activeCopy.offBody} ${activeCopy.onlyOnline}` : activeCopy.offBody}
        confirmLabel={activeCopy.confirmOff}
        busy={busy}
        onConfirm={confirmOff}
      />
    </>
  )
}
