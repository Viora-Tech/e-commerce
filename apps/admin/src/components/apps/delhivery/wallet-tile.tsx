'use client'

import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import { toast } from 'sonner'
import MoneyInput from '@/components/fields/money-input'
import FormDialog from '@/components/layout/form-dialog'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import OverviewTile from './overview-tile'

type Wallet = Awaited<ReturnType<typeof api.shipments.wallets>>[number]

type WalletTileProps = {
  /** Delhivery's card from `shipments.wallets`; null while loading or when it is not connected. */
  wallet: Wallet | null
  loading: boolean
  onSaved: () => void
}

/**
 * The Wallet tile: the balance the Shipments wallet card keeps (Delhivery has no balance API, so
 * it is the one typed here, `shipments.recordWalletBalance`), the low-balance alert line and
 * Recharge on Delhivery One.
 */
export default function WalletTile({ wallet, loading, onSaved }: WalletTileProps) {
  // Hooks
  const { overview: copy } = useCopy(delhiveryAppContent)
  const format = useFormat()
  const { hasPermission } = usePermissions()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  // Event handlers
  const handleOpen = () => {
    setDraft(wallet?.fetchedAt ? String(wallet.balancePaise / 100) : '')
    setOpen(true)
  }
  const handleSave = async () => {
    const rupees = Number(draft)
    if (!Number.isFinite(rupees) || rupees < 0) return
    try {
      await api.shipments.recordWalletBalance({
        providerId: 'delhivery',
        balancePaise: Math.round(rupees * 100),
      })
      toast.success(copy.walletDialog.saved)
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  // Render logic
  const recorded = Boolean(wallet?.fetchedAt)
  const threshold = format.moneyWhole(wallet?.lowBalanceThresholdPaise ?? 0)
  const value = loading ? null : recorded && wallet ? format.moneyWhole(wallet.balancePaise) : '—'
  const canRecord = wallet !== null && hasPermission(permissions.ORDERS_FULFIL)
  const note = !wallet
    ? null
    : !recorded
      ? copy.tiles.notRecordedNote
      : wallet.low
        ? copy.tiles.low(threshold)
        : copy.tiles.lowAlert(threshold)
  const draftValid = draft.trim() !== '' && Number.isFinite(Number(draft)) && Number(draft) >= 0

  return (
    <>
      <OverviewTile
        label={copy.tiles.wallet}
        value={value}
        attention={recorded && Boolean(wallet?.low)}
        note={
          <span className="flex flex-wrap items-center gap-x-2">
            {note}
            {canRecord ? (
              <button
                type="button"
                onClick={handleOpen}
                className="rounded-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copy.tiles.update}
              </button>
            ) : null}
          </span>
        }
        action={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={copy.rechargeUrl} target="_blank" rel="noreferrer" />}
          >
            {copy.tiles.recharge}
          </Button>
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.walletDialog.title}
        submitLabel={copy.walletDialog.save}
        submitDisabled={!draftValid}
        onSubmit={handleSave}
      >
        <Field>
          <FieldLabel htmlFor="delhivery-wallet">{copy.walletDialog.label}</FieldLabel>
          <MoneyInput id="delhivery-wallet" size="lg" value={draft} onChange={setDraft} />
          <FieldDescription>{copy.walletDialog.body}</FieldDescription>
        </Field>
      </FormDialog>
    </>
  )
}
