'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { CHECKOUT_LIMITS, type CodRules, parsePincodeList } from '@commerce/core/checkout-settings'
import { Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useRef, useState } from 'react'
import PaymentAdjustmentFields from '@/components/settings/payment-adjustment-fields'
import RupeeInput from '@/components/settings/rupee-input'
import { checkoutSettingsContent as content } from '@/data/checkout-settings'
import SettingsCard from './settings-card'

type CodRulesCardProps = {
  codEnabled: boolean
  rules: CodRules
  fee: PaymentAdjustment | null
  onRules: (rules: CodRules) => void
  onFee: (fee: PaymentAdjustment | null) => void
}

const copy = content.cod

/** Settings → Checkout: cash on delivery fee, limit, blocked PIN codes and the WhatsApp flag. */
export default function CodRulesCard({
  codEnabled,
  rules,
  fee,
  onRules,
  onFee,
}: CodRulesCardProps) {
  // Hooks
  const [text, setText] = useState(rules.blockedPincodes.join('\n'))
  const [invalid, setInvalid] = useState<string[]>([])
  const [tooMany, setTooMany] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Helpers
  const applyList = (raw: string) => {
    const parsed = parsePincodeList(raw)
    const over = parsed.pincodes.length > CHECKOUT_LIMITS.blockedPincodes
    setTooMany(over)
    setInvalid(parsed.invalid)
    const pincodes = parsed.pincodes.slice(0, CHECKOUT_LIMITS.blockedPincodes)
    setText(pincodes.join('\n'))
    onRules({ ...rules, blockedPincodes: pincodes })
  }

  // Event handlers
  const handleFile = async (file: File | undefined) => {
    if (!file) return
    applyList(`${text}\n${await file.text()}`)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Early returns
  if (!codEnabled) {
    return (
      <SettingsCard id="cod" title={copy.heading} description={copy.off}>
        <Button variant="outline" render={<Link href="/settings/payments" />}>
          {copy.offLink}
        </Button>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard id="cod" title={copy.heading}>
      <FieldGroup>
        <div className="flex flex-col gap-1">
          <PaymentAdjustmentFields
            providerId="cod"
            value={fee ?? undefined}
            onChange={(next) => onFee(next ?? null)}
          />
          <p className="text-caption text-muted-foreground">{copy.feeHint}</p>
        </div>
        <RupeeInput
          id="cod-max"
          label={copy.max}
          hint={copy.maxHint}
          paise={rules.maxOrderPaise}
          onChange={(maxOrderPaise) => onRules({ ...rules, maxOrderPaise })}
        />
        <Field data-invalid={tooMany}>
          <FieldLabel htmlFor="cod-blocked">{copy.blocked}</FieldLabel>
          <Textarea
            id="cod-blocked"
            rows={5}
            inputMode="numeric"
            value={text}
            placeholder={'110001\n560001'}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => applyList(text)}
          />
          <FieldDescription>
            {copy.blockedHint} {copy.blockedCount(rules.blockedPincodes.length)}
          </FieldDescription>
          {invalid.length > 0 ? (
            <FieldDescription>{copy.invalid(invalid.join(', '))}</FieldDescription>
          ) : null}
          {tooMany ? (
            <FieldError>{copy.tooMany(CHECKOUT_LIMITS.blockedPincodes)}</FieldError>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            aria-label={copy.upload}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button variant="outline" className="self-start" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden="true" />
            {copy.upload}
          </Button>
        </Field>
        <Field orientation="horizontal" className="items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="cod-whatsapp">{copy.whatsapp}</FieldLabel>
            <FieldDescription>{copy.whatsappHint}</FieldDescription>
          </div>
          <Switch
            id="cod-whatsapp"
            checked={rules.confirmOnWhatsApp}
            onCheckedChange={(confirmOnWhatsApp) => onRules({ ...rules, confirmOnWhatsApp })}
          />
        </Field>
      </FieldGroup>
    </SettingsCard>
  )
}
