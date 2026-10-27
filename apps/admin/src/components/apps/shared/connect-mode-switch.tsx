'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: ConnectModeSwitch, ModeSwitch
 * WHAT:  the Test/Live switch on a provider app's Connect page, with a line explaining the choice.
 * WHY:   one owner for the switch; how the choice is stored differs per provider (Delhivery points
 *        the base URL at staging, Decentro saves a `mode` field), so that lives in `ModeSwitch`.
 * WHERE: ProviderConnectPage, when a provider passes `mode`. A payments app with two saved key
 *        sets (`keySets`, Decentro) gets the payment gateways' own PaymentModeControl instead,
 *        which picks the set being edited rather than relabelling the keys on screen.
 */

import { gatewayKeySets } from '@commerce/core/payment-modes'

import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import PaymentModeControl from '@/components/payments/payment-mode-control'
import { paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import type { FieldValues, SettingsBlob } from './provider-settings'

type Mode = 'test' | 'live'

export type ModeSwitch = {
  read: (values: FieldValues) => Mode
  write: (mode: string, setField: (key: string, value: string) => void) => void
  copy: { label: string; test: string; live: string; help: { test: string; live: string } }
  /** The provider keeps a test and a live key set (payments): the switch picks which one to edit. */
  keySets?: boolean
}

type ConnectModeSwitchProps = {
  providerId: string
  mode: ModeSwitch
  values: FieldValues
  setField: (key: string, value: string) => void
  providers: SettingsBlob['providers']
  onKeySet: (mode: Mode) => void
}

export default function ConnectModeSwitch({
  providerId,
  mode,
  values,
  setField,
  providers,
  onKeySet,
}: ConnectModeSwitchProps) {
  // Hooks
  const { keySet: keySetCopy } = useCopy(paymentModesContent)

  // Event handlers
  const handleModeChange = (next: string[]) => {
    const picked = next[0]
    if (picked) mode.write(picked, setField)
  }

  // Early returns
  const current = mode.read(values)
  const sets = gatewayKeySets(providers, providerId)
  if (mode.keySets) {
    return (
      <>
        <PaymentModeControl
          id={providerId}
          label={keySetCopy.pickerLabel}
          value={current}
          active={sets.active}
          keys={{ test: !!sets.test, live: !!sets.live }}
          onChange={onKeySet}
        />
        <p className="text-caption text-muted-foreground">
          {mode.copy.help[current]} {keySetCopy.editing(current)}
          {sets.active ? ` ${keySetCopy.checkoutUses(sets.active)}` : null}
        </p>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span id={`${providerId}-mode-label`} className="text-body font-medium text-foreground">
          {mode.copy.label}
        </span>
        <ToggleGroup
          aria-labelledby={`${providerId}-mode-label`}
          value={[current]}
          onValueChange={handleModeChange}
          variant="outline"
          spacing={0}
        >
          <ToggleGroupItem value="test">{mode.copy.test}</ToggleGroupItem>
          <ToggleGroupItem value="live">{mode.copy.live}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <p className="text-caption text-muted-foreground">{mode.copy.help[current]}</p>
    </>
  )
}
