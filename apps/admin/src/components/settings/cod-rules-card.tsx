'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { CHECKOUT_LIMITS, type CodRules, parsePincodeList } from '@commerce/core/checkout-settings'
import { Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import Link from 'next/link'
import { useRef, useState } from 'react'
import PaymentAdjustmentFields from '@/components/settings/payment-adjustment-fields'
import RupeeInput from '@/components/settings/rupee-input'
import { checkoutSettingsContent as content } from '@/data/checkout-settings'
import { routes } from '@/lib/routes'
import SettingsCard from './settings-card'
import SettingsRow from './settings-row'
import SettingsToggleRow from './settings-toggle-row'

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
        <Button variant="outline" render={<Link href={routes.settings.payments()} />}>
          {copy.offLink}
        </Button>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard id="cod" title={copy.heading}>
      <div className="flex flex-col gap-2 border-b border-hairline pb-5">
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
      <SettingsRow
        label={copy.blocked}
        description={`${copy.blockedHint} ${copy.blockedCount(rules.blockedPincodes.length)}`}
        htmlFor="cod-blocked"
        error={tooMany ? copy.tooMany(CHECKOUT_LIMITS.blockedPincodes) : undefined}
      >
        <Textarea
          id="cod-blocked"
          rows={5}
          inputMode="numeric"
          value={text}
          placeholder={'110001\n560001'}
          aria-invalid={tooMany || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => applyList(text)}
        />
        {invalid.length > 0 ? (
          <p className="text-caption text-muted-foreground">{copy.invalid(invalid.join(', '))}</p>
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
      </SettingsRow>
      <SettingsToggleRow
        id="cod-whatsapp"
        label={copy.whatsapp}
        description={copy.whatsappHint}
        checked={rules.confirmOnWhatsApp}
        onChange={(confirmOnWhatsApp) => onRules({ ...rules, confirmOnWhatsApp })}
      />
    </SettingsCard>
  )
}
