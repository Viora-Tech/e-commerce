'use client'

import { permissions } from '@commerce/core/permissions'
import { parseRupees } from '@commerce/money'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { useEffect, useId, useState } from 'react'
import {
  type DraftStoreCreditProblem,
  draftStoreCreditMax,
} from '@/components/drafts/draft-form-state'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import FormDialog from '@/components/layout/form-dialog'
import { draftStoreCreditContent } from '@/data/draft-store-credit'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'

type DraftStoreCreditCardProps = {
  customerId: string | null
  /** The draft's total as typed: store credit never goes above it. */
  totalPaise: number
  /** Applied now, in paise; 0 for none. */
  storeCreditPaise: number
  problem: DraftStoreCreditProblem | null
  onChange: (storeCreditPaise: number) => void
  /** The customer's balance once loaded (null while loading or unknown). */
  onBalance: (balancePaise: number | null) => void
}

const paiseToText = (paise: number) => (paise > 0 ? (paise / 100).toFixed(2) : '')

/**
 * Store credit on a draft (store credit step 3): the picked customer's balance and "Apply store
 * credit", part or all of it up to min(balance, total). Saving the draft keeps it; converting
 * takes it from the balance. Store credit is a balance on the customer, never a code.
 */
export default function DraftStoreCreditCard({
  customerId,
  totalPaise,
  storeCreditPaise,
  problem,
  onChange,
  onBalance,
}: DraftStoreCreditCardProps) {
  // Hooks
  const copy = useCopy(draftStoreCreditContent)
  const fmt = useFormat()
  const { hasPermission } = usePermissions()
  const amountId = useId()
  const [balance, setBalance] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload only when the customer changes.
  useEffect(() => {
    let live = true
    setBalance(null)
    setFailed(false)
    onBalance(null)
    if (!customerId || !hasPermission(permissions.CUSTOMERS_READ)) return
    api.storeCredit
      .get({ customerId })
      .then((a) => {
        if (!live) return
        setBalance(a.balancePaise)
        onBalance(a.balancePaise)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [customerId])

  // Event handlers
  const handleOpen = () => {
    setAmount(paiseToText(storeCreditPaise || draftStoreCreditMax(balance ?? 0, totalPaise)))
    setOpen(true)
  }

  const handleSubmit = () => {
    onChange(parseRupees(amount) ?? 0)
    setOpen(false)
  }

  // Early returns
  // Staff without customers.read cannot see a balance, so the card stays away.
  const canRead = hasPermission(permissions.CUSTOMERS_READ)
  if (!customerId || !canRead) return null

  // Render logic
  const max = draftStoreCreditMax(balance ?? 0, totalPaise)
  const typed = parseRupees(amount)
  const tooMuch = typed !== null && typed > max
  const valid = typed !== null && typed > 0 && !tooMuch

  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-3">
      {failed ? (
        <p className="text-caption text-destructive">{copy.loadFailed}</p>
      ) : balance === null ? null : (
        <p className="text-body text-muted-foreground">
          {balance > 0 ? copy.balance(fmt.money(balance)) : copy.none}
        </p>
      )}
      {storeCreditPaise > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body font-medium text-foreground">
              {copy.applied(fmt.money(storeCreditPaise))}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={handleOpen} disabled={balance === null}>
                {copy.edit}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onChange(0)}>
                {copy.remove}
              </Button>
            </div>
          </div>
          <p className="text-caption text-muted-foreground">{copy.appliedNote}</p>
        </div>
      ) : balance !== null && balance > 0 ? (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={handleOpen}
          disabled={totalPaise <= 0}
        >
          {copy.apply}
        </Button>
      ) : null}
      {problem ? <p className="text-caption text-destructive">{copy.problems[problem]}</p> : null}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={copy.dialog.title}
        submitLabel={copy.dialog.apply}
        cancelLabel={copy.dialog.cancel}
        submitDisabled={!valid}
        onSubmit={handleSubmit}
        size="md"
      >
        <Field data-invalid={tooMuch || undefined}>
          <FieldLabel htmlFor={amountId}>{copy.dialog.amount}</FieldLabel>
          <MoneyInput id={amountId} value={amount} onChange={setAmount} />
          {tooMuch ? (
            <FieldError>{copy.dialog.tooMuch(fmt.money(max))}</FieldError>
          ) : (
            <FieldDescription>{copy.dialog.max(fmt.money(max))}</FieldDescription>
          )}
        </Field>
        <Button
          size="sm"
          variant="link"
          className="h-auto self-start px-0"
          onClick={() => setAmount(paiseToText(max))}
        >
          {copy.dialog.fillMax(fmt.money(max))}
        </Button>
      </FormDialog>
    </DataCard>
  )
}
