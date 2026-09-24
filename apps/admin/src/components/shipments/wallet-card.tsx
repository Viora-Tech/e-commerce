'use client'

import { CreditCard } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shipmentsContent } from '@/data/shipments'
import { api } from '@/lib/api-client'

type Wallet = Awaited<ReturnType<typeof api.shipments.wallet>>

const copy = shipmentsContent.wallet
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

/** Balance card: manual entry for Delhivery (no live API yet), refresh for a courier that has one. */
export default function WalletCard() {
  // Hooks
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.shipments
      .wallet()
      .then((r) => {
        if (!cancelled) setWallet(r)
      })
      .catch(() => {
        if (!cancelled) setWallet(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Event handlers
  const handleRefresh = async () => {
    setBusy(true)
    try {
      await api.shipments.refreshWallet({})
      setWallet(await api.shipments.wallet())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    const rupeesValue = Number.parseFloat(input)
    if (!Number.isFinite(rupeesValue) || rupeesValue < 0) return
    setBusy(true)
    try {
      await api.shipments.recordWalletBalance({ balancePaise: Math.round(rupeesValue * 100) })
      setWallet(await api.shipments.wallet())
      setInput('')
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!wallet) return null

  return (
    <DataCard
      title={copy.heading}
      icon={<CreditCard aria-hidden="true" />}
      action={wallet.low ? <Badge variant="destructive">{copy.low}</Badge> : null}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-caption text-muted-foreground">{copy.balance}</p>
          <p className="text-heading-3 font-bold text-ink-strong">{rupees(wallet.balancePaise)}</p>
          <p className="text-caption text-muted-foreground">
            {copy.threshold} {rupees(wallet.lowBalanceThresholdPaise)}
          </p>
        </div>
        <div className="flex items-end gap-2">
          {wallet.supportsLiveBalance ? (
            <Button variant="outline" onClick={handleRefresh} disabled={busy}>
              {copy.refresh}
            </Button>
          ) : (
            <>
              <Input
                size="lg"
                type="number"
                placeholder={copy.recordLabel}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-48"
              />
              <Button onClick={handleSave} disabled={busy || !input}>
                {copy.record}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            render={<a href="https://one.delhivery.com/" target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            {copy.recharge}
          </Button>
        </div>
      </div>
      {!wallet.supportsLiveBalance ? (
        <p className="mt-2 text-caption text-muted-foreground">{copy.apiNote}</p>
      ) : null}
    </DataCard>
  )
}
