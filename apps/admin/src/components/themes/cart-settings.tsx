'use client'

import type { Theme } from '@commerce/core/theme'
import { themesContent as copy } from '@/data/themes'
import ChoiceField from './choice-field'
import SwitchField from './switch-field'

type CartSettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

const TYPES = (['drawer', 'page'] as const).map((value) => ({
  value,
  label: copy.cart.types[value],
}))

/** Theme settings → Cart: drawer or cart page, and the free shipping bar. */
export default function CartSettings({ theme, onChange }: CartSettingsProps) {
  // Helpers
  const setCart = (patch: Partial<Theme['cart']>) =>
    onChange({ ...theme, cart: { ...theme.cart, ...patch } })

  // Render logic
  return (
    <>
      <ChoiceField
        label={copy.cart.type}
        value={theme.cart.type}
        options={TYPES}
        onChange={(type) => setCart({ type })}
      />
      <p className="text-xs text-muted-foreground">{copy.cart.typeHelp}</p>
      <SwitchField
        label={copy.cart.freeShippingBar}
        help={copy.cart.freeShippingHelp}
        checked={theme.cart.freeShippingBar}
        onChange={(freeShippingBar) => setCart({ freeShippingBar })}
      />
    </>
  )
}
