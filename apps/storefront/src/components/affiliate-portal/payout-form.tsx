'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { savePayoutDetailsAction } from '@/lib/affiliate-actions'

type PayoutFormProps = { hint: string | null }

type Method = 'upi' | 'bank'

const copy = affiliateContent.payout

/**
 * Settings › Payout and tax: UPI ID or bank account, PAN and GSTIN. What is saved is never shown
 * back, only the masked hint ("UPI as•••@okaxis"); saving again replaces it.
 */
export default function PayoutForm({ hint }: PayoutFormProps) {
  // Hooks
  const router = useRouter()
  const [pending, start] = useTransition()
  const [method, setMethod] = useState<Method>('upi')
  const [upiId, setUpiId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [pan, setPan] = useState('')
  const [gstin, setGstin] = useState('')
  const [error, setError] = useState<{ message: string; field?: string | undefined } | null>(null)
  const [saved, setSaved] = useState(false)

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const panValue = pan.trim() || undefined
    const gstinValue = gstin.trim() || undefined
    const details =
      method === 'upi'
        ? { method, upiId, pan: panValue, gstin: gstinValue }
        : { method, accountName, accountNumber, ifsc, pan: panValue, gstin: gstinValue }
    start(async () => {
      const r = await savePayoutDetailsAction(details)
      if (r.ok) {
        setSaved(true)
        setUpiId('')
        setAccountNumber('')
        setPan('')
        setGstin('')
        router.refresh()
      } else {
        setError({ message: copy.errors[r.error] ?? copy.errors.generic ?? '', field: r.field })
      }
    })
  }

  // Render logic
  const invalid = (field: string) => (error?.field === field ? true : undefined)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{hint ? copy.current(hint) : copy.none}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <RadioGroup
              value={method}
              onValueChange={(v) => setMethod(v as Method)}
              className="flex gap-6"
            >
              {(['upi', 'bank'] as const).map((m) => (
                <Field key={m} orientation="horizontal" className="w-auto">
                  <RadioGroupItem value={m} id={`payout-${m}`} />
                  <FieldLabel htmlFor={`payout-${m}`}>
                    {m === 'upi' ? copy.upi : copy.bank}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
            {method === 'upi' ? (
              <Field data-invalid={invalid('upiId')}>
                <FieldLabel htmlFor="po-upi">{copy.upiId}</FieldLabel>
                <Input
                  id="po-upi"
                  autoComplete="off"
                  inputMode="email"
                  placeholder="name@bank"
                  value={upiId}
                  aria-invalid={invalid('upiId')}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field data-invalid={invalid('accountName')}>
                  <FieldLabel htmlFor="po-name">{copy.accountName}</FieldLabel>
                  <Input
                    id="po-name"
                    autoComplete="name"
                    value={accountName}
                    aria-invalid={invalid('accountName')}
                    onChange={(e) => setAccountName(e.target.value)}
                  />
                </Field>
                <Field data-invalid={invalid('accountNumber')}>
                  <FieldLabel htmlFor="po-number">{copy.accountNumber}</FieldLabel>
                  <Input
                    id="po-number"
                    autoComplete="off"
                    inputMode="numeric"
                    value={accountNumber}
                    aria-invalid={invalid('accountNumber')}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </Field>
                <Field data-invalid={invalid('ifsc')}>
                  <FieldLabel htmlFor="po-ifsc">{copy.ifsc}</FieldLabel>
                  <Input
                    id="po-ifsc"
                    autoComplete="off"
                    maxLength={11}
                    className="uppercase"
                    value={ifsc}
                    aria-invalid={invalid('ifsc')}
                    onChange={(e) => setIfsc(e.target.value)}
                  />
                </Field>
              </>
            )}
            <FieldSeparator />
            <Field data-invalid={invalid('pan')}>
              <FieldLabel htmlFor="po-pan">{copy.pan}</FieldLabel>
              <Input
                id="po-pan"
                autoComplete="off"
                maxLength={10}
                className="uppercase"
                value={pan}
                aria-invalid={invalid('pan')}
                onChange={(e) => setPan(e.target.value)}
              />
              <FieldDescription>{copy.panHint}</FieldDescription>
            </Field>
            <Field data-invalid={invalid('gstin')}>
              <FieldLabel htmlFor="po-gstin">{copy.gstin}</FieldLabel>
              <Input
                id="po-gstin"
                autoComplete="off"
                maxLength={15}
                className="uppercase"
                value={gstin}
                aria-invalid={invalid('gstin')}
                onChange={(e) => setGstin(e.target.value)}
              />
              <FieldDescription>{copy.gstinHint}</FieldDescription>
            </Field>
            {error ? <FieldError>{error.message}</FieldError> : null}
            <div className="flex items-center gap-3">
              <Button type="submit" loading={pending}>
                {pending ? copy.saving : copy.save}
              </Button>
              {saved ? (
                <span className="text-sm text-success" role="status">
                  {copy.saved}
                </span>
              ) : null}
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
