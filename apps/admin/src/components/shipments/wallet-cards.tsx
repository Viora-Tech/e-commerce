'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import WalletCard from './wallet-card'

type Wallets = Awaited<ReturnType<typeof api.shipments.wallets>>

/** One wallet card per connected courier. Renders nothing for a store with no courier connected
 *  yet - the Shipments workspace already leads with the book panel in that case. */
export default function WalletCards() {
  // Hooks
  const [wallets, setWallets] = useState<Wallets | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey has no bearing on the query itself; bumping it just re-runs this effect
    // after a wallet is refreshed or recorded, the same way shipments-tab.tsx does.
    if (reloadKey < 0) return
    let cancelled = false
    api.shipments.wallets().then((r) => {
      if (!cancelled) setWallets(r)
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Event handlers
  const handleChanged = () => setReloadKey((k) => k + 1)

  // Early returns
  if (!wallets || wallets.length === 0) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {wallets.map((w) => (
        <WalletCard key={w.provider} wallet={w} onChanged={handleChanged} />
      ))}
    </div>
  )
}
