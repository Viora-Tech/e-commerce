'use client'

import { CreditCard } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shipmentsContent } from '@/data/shipments'
import { api } from '@/lib/api-client'

type Wallet = Awaited<ReturnType<typeof api.shipments.wallets>>[number]

type WalletCardProps = { wallet: Wallet; onChanged: () => void }

const copy = shipmentsContent.wallet
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

/** One courier's balance card: manual entry for a courier with no live balance API (Delhivery),
 *  refresh for one that has it (Shiprocket). A multi-courier store shows one of these per
 *  connected courier. */
export default function WalletCard({ wallet, onChanged }: WalletCardProps) {
  // Hooks
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleRefresh = async () => {
    setBusy(true)
    try {
      await api.shipments.refreshWallet({ providerId: wallet.provider })
      onChanged()
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
      await api.shipments.recordWalletBalance({
        providerId: wallet.provider,
        balancePaise: Math.round(rupeesValue * 100),
      })
      onChanged()
      setInput('')
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const rechargeUrl = copy.rechargeUrl[wallet.provider]

  return (
    <DataCard
      title={copy.heading(wallet.providerLabel)}
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
          {rechargeUrl ? (
            <Button
              variant="outline"
              render={<a href={rechargeUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              {copy.recharge(wallet.providerLabel)}
            </Button>
          ) : null}
        </div>
      </div>
      {!wallet.supportsLiveBalance ? (
        <p className="mt-2 text-caption text-muted-foreground">
          {copy.apiNote(wallet.providerLabel)}
        </p>
      ) : null}
    </DataCard>
  )
}
