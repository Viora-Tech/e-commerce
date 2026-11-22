'use client'

import type { Theme } from '@commerce/core/theme'
import SwitchRow from '@/components/fields/switch-row'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import ChoiceField from './choice-field'

type CartSettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

const TYPES = ['drawer', 'page'] as const

/** Theme settings → Cart: drawer or cart page, and the free shipping bar. */
export default function CartSettings({ theme, onChange }: CartSettingsProps) {
  // Hooks
  const copy = useCopy(themesContent)

  // Derived
  const types = TYPES.map((value) => ({ value, label: copy.cart.types[value] }))

  // Helpers
  const setCart = (patch: Partial<Theme['cart']>) =>
    onChange({ ...theme, cart: { ...theme.cart, ...patch } })

  // Render logic
  return (
    <>
      <ChoiceField
        label={copy.cart.type}
        value={theme.cart.type}
        options={types}
        onChange={(type) => setCart({ type })}
      />
      <p className="text-period text-muted-foreground">{copy.cart.typeHelp}</p>
      <SwitchRow
        label={copy.cart.freeShippingBar}
        description={copy.cart.freeShippingHelp}
        checked={theme.cart.freeShippingBar}
        onChange={(freeShippingBar) => setCart({ freeShippingBar })}
        weight="normal"
      />
    </>
  )
}
