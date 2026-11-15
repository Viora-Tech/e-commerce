'use client'

import { PlugConnect } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { loadProviderSettings, readTestedFlag } from '@/components/apps/shared/provider-settings'
import EmptyState from '@/components/layout/empty-state'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { useStorageScope } from '@/lib/storage-scope'
import ConnectionCard from './connection-card'
import OverviewTile from './overview-tile'
import PickupLocationsCard from './pickup-locations-card'
import RecentShipmentsCard from './recent-shipments-card'
import WalletTile from './wallet-tile'

type Activity = Awaited<ReturnType<typeof api.shipments.courierOverview>>
type Wallet = Awaited<ReturnType<typeof api.shipments.wallets>>[number]
/** The Delhivery connection as the Connect page saved it; `saved` null when unreadable. */
type Account = { connected: boolean; saved: Record<string, string> | null }

const PROVIDER = 'delhivery'

/** The four tiles as one joined strip, like `StatStrip` (the wallet tile keeps its buttons). */
const STRIP =
  'grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-[var(--shadow-card)] sm:grid-cols-2 xl:grid-cols-4'

/** Settings › Shipping needs `settings.read`; a member without it still sees the rest. */
async function loadAccount(): Promise<Account> {
  try {
    const r = await loadProviderSettings('shipping')
    return {
      connected: r.settings.enabled.includes(PROVIDER),
      saved: r.settings.providers[PROVIDER] ?? {},
    }
  } catch {
    return { connected: true, saved: null }
  }
}

/**
 * `/apps/delhivery` (Figma 928:11256 "Delhivery · Overview"): wallet, booked today, in transit
 * and RTO this month; the newest Delhivery shipments; its pickup locations and the connection.
 * Everything is this courier's only. The app bar above carries the tracking pill.
 */
export default function OverviewPage() {
  // Hooks
  const { overview: copy } = useCopy(delhiveryAppContent)
  const format = useFormat()
  const storageScope = useStorageScope()
  const [account, setAccount] = useState<Account | null>(null)
  const [activity, setActivity] = useState<Activity | null>(null)
  /** The figures did not load: dashes, not bars that never fill. */
  const [activityFailed, setActivityFailed] = useState(false)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [walletLoading, setWalletLoading] = useState(true)
  const recent = useLoad(
    async () => (await api.shipments.list({ provider: PROVIDER, page: 1, perPage: 4 })).items,
  )
  const places = useLoad(() => api.shipments.courierPickupPlaces({ provider: PROVIDER }))
  const [tested, setTested] = useState(false)
  const [walletKey, setWalletKey] = useState(0)
  useEffect(() => {
    let live = true
    loadAccount().then((a) => live && setAccount(a))
    api.shipments
      .courierOverview({ provider: PROVIDER })
      .then((a) => live && setActivity(a))
      .catch(() => live && setActivityFailed(true))
    setTested(readTestedFlag(storageScope, PROVIDER))
    return () => {
      live = false
    }
  }, [storageScope])
  // The wallet again after the balance is typed in.
  useEffect(() => {
    if (walletKey < 0) return
    let live = true
    api.shipments
      .wallets()
      .then((w) => live && setWallet(w.find((x) => x.provider === PROVIDER) ?? null))
      .catch(() => live && setWallet(null))
      .finally(() => live && setWalletLoading(false))
    return () => {
      live = false
    }
  }, [walletKey])

  // Early returns
  if (account && !account.connected) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <EmptyState
          variant="page"
          icon={PlugConnect}
          body={copy.notConnected}
          action={
            <Button render={<Link href={routes.apps.connect(PROVIDER)} />} nativeButton={false}>
              <PlugConnect aria-hidden="true" />
              {copy.connectCta}
            </Button>
          }
        />
      </div>
    )
  }

  // Render logic
  const t = copy.tiles
  const a = activity
  /* Before the figures: `null` draws the loading bar; after a failed read, a dash. */
  const dash = activityFailed ? '—' : null
  const rtoPercent =
    a && a.bookedThisMonth > 0
      ? `${format.number(Math.round((a.rtoThisMonth / a.bookedThisMonth) * 1000) / 10)}%`
      : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <div className={STRIP}>
        <WalletTile
          wallet={wallet}
          loading={walletLoading}
          onSaved={() => setWalletKey((k) => k + 1)}
        />
        <OverviewTile
          label={t.bookedToday}
          value={a ? format.number(a.bookedToday) : dash}
          note={
            a
              ? a.bookedToday > 0
                ? t.charged(format.moneyWhole(a.chargedTodayPaise))
                : t.noneToday
              : null
          }
        />
        <OverviewTile
          label={t.inTransit}
          value={a ? format.number(a.moving) : dash}
          note={a ? (a.delayed > 0 ? t.delayed(a.delayed) : t.noneDelayed) : null}
        />
        <OverviewTile
          label={t.rto}
          value={a ? format.number(a.rtoThisMonth) : dash}
          note={a ? (rtoPercent ? t.rtoOf(rtoPercent, a.bookedThisMonth) : t.noneThisMonth) : null}
        />
      </div>
      <PageColumns
        main={
          <RecentShipmentsCard
            items={recent.data}
            failed={recent.failed !== false}
            onRetry={recent.retry}
          />
        }
        side={
          <>
            <PickupLocationsCard
              places={places.data}
              failed={places.failed !== false}
              onRetry={places.retry}
            />
            <ConnectionCard saved={account?.saved ?? null} tested={tested} />
          </>
        }
      />
    </div>
  )
}
