'use client'

import { parseRupees } from '@commerce/money'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useId, useState } from 'react'
import type { DraftCodeCheck, DraftFormState } from '@/components/drafts/draft-form-state'
import MoneyInput from '@/components/fields/money-input'
import FormDialog from '@/components/layout/form-dialog'
import PillTabs from '@/components/layout/pill-tabs'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'

type Mode = 'code' | 'manual'

type DraftDiscountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: DraftFormState
  /** Check a typed code with checkout's rules; resolves with the server's answer. */
  onCheckCode: (typed: string) => Promise<DraftCodeCheck>
  /** Apply the change: a code (which clears the manual amount) or a manual amount and reason. */
  onChange: (patch: Partial<DraftFormState>) => void
}

const paiseToText = (paise: number) => (paise > 0 ? (paise / 100).toFixed(2) : '')

/**
 * "Add discount" on a draft (audit #29): a store discount code, checked like checkout, or an
 * amount off with an optional reason. The two never stack; applying one replaces the other.
 */
export default function DraftDiscountDialog({
  open,
  onOpenChange,
  form,
  onCheckCode,
  onChange,
}: DraftDiscountDialogProps) {
  // Hooks
  const { totals: copy } = useCopy(draftEditorContent)
  const codeId = useId()
  const amountId = useId()
  const reasonId = useId()
  const [mode, setMode] = useState<Mode>('manual')
  const [code, setCode] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the fields start from the draft each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setMode(form.discountCode ? 'code' : 'manual')
    setCode(form.discountCode)
    setAmount(paiseToText(form.discountPaise))
    setReason(form.discountLabel)
    setError(null)
  }, [open])

  // Event handlers
  const handleSubmit = async () => {
    if (mode === 'manual') {
      onChange({
        discountCode: '',
        discountPaise: parseRupees(amount) ?? 0,
        discountLabel: reason.trim(),
      })
      onOpenChange(false)
      return
    }
    setError(null)
    try {
      const r = await onCheckCode(code.trim())
      if (!r.ok) {
        setError(copy.code.rejected[r.reason])
        return
      }
      onChange({ discountCode: r.code, discountPaise: 0, discountLabel: '' })
      onOpenChange(false)
    } catch {
      setError(copy.code.failed)
    }
  }

  // Render logic
  const ids = { code: codeId, amount: amountId, reason: reasonId }
  const ready = mode === 'code' ? code.trim().length > 0 : parseRupees(amount) !== null
  const editing = Boolean(form.discountCode) || form.discountPaise > 0

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? copy.discountDialog.editTitle : copy.discountDialog.title}
      submitLabel={copy.discountDialog.apply}
      cancelLabel={copy.discountDialog.cancel}
      submitDisabled={!ready}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <PillTabs<Mode>
          variant="segmented"
          value={mode}
          onChange={(next) => {
            setMode(next)
            setError(null)
          }}
          tabs={[
            { value: 'manual', label: copy.discountDialog.manual },
            { value: 'code', label: copy.discountDialog.code },
          ]}
          className="self-start"
        />
        {mode === 'code' ? (
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={ids.code}>{copy.code.label}</FieldLabel>
            <Input
              id={ids.code}
              value={code}
              placeholder={copy.code.placeholder}
              autoComplete="off"
              onChange={(e) => {
                setCode(e.target.value)
                setError(null)
              }}
              className="uppercase placeholder:normal-case"
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>{copy.code.help}</FieldDescription>
            )}
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor={ids.amount}>{copy.discountDialog.amount}</FieldLabel>
              <MoneyInput id={ids.amount} value={amount} onChange={setAmount} />
            </Field>
            <Field>
              <FieldLabel htmlFor={ids.reason}>{copy.discountDialog.reason}</FieldLabel>
              <Input
                id={ids.reason}
                value={reason}
                maxLength={120}
                onChange={(e) => setReason(e.target.value)}
              />
              <FieldDescription>{copy.discountDialog.reasonHelp}</FieldDescription>
            </Field>
          </>
        )}
      </div>
    </FormDialog>
  )
}
