'use client'

import { CART_LIMIT_MAX, type CartLimit } from '@commerce/core/checkout-settings'
import { Input } from '@commerce/ui/shadcn/input'
import { itemTabs, loadPicked } from '@/components/discounts/pick-sources'
import PickedField from '@/components/pickers/picked-field'
import { checkoutRulesContent } from '@/data/checkout-rules'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import SettingsCard from './settings-card'
import SettingsRow from './settings-row'

type CartLimitCardProps = {
  limit: CartLimit
  onChange: (limit: CartLimit) => void
}

/** A typed number as a limit: whole, 0 or more, never past the most we store. */
const toLimit = (raw: string, min: number): number => {
  const n = Number.parseInt(raw.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? Math.min(CART_LIMIT_MAX, Math.max(min, n)) : min
}

/**
 * Settings → Checkout → Cart limit (#156): the store-wide most of one product per cart, and
 * products with their own number (picked through the Browse dialog, a limit box on each row).
 * `addToCart` stops at it and `placeOrder` refuses a cart over it.
 */
export default function CartLimitCard({ limit, onChange }: CartLimitCardProps) {
  // Hooks
  const { cartLimit: copy } = useCopy(checkoutRulesContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()

  // Event handlers
  const handlePicked = (ids: string[]) =>
    onChange({
      ...limit,
      overrides: ids.map(
        (productId) =>
          limit.overrides.find((o) => o.productId === productId) ?? {
            productId,
            max: limit.maxPerProduct > 0 ? limit.maxPerProduct : 1,
          },
      ),
    })
  const handleOverride = (productId: string, raw: string) =>
    onChange({
      ...limit,
      overrides: limit.overrides.map((o) =>
        o.productId === productId ? { ...o, max: toLimit(raw, 1) } : o,
      ),
    })

  // Render logic
  const productTabs = itemTabs(discountCopy.value, locale).filter((t) => t.key === 'products')

  return (
    <SettingsCard title={copy.heading} description={copy.description}>
      <SettingsRow label={copy.max} description={copy.maxHint} htmlFor="checkout-cart-limit">
        <Input
          id="checkout-cart-limit"
          inputMode="numeric"
          className="max-w-32"
          value={String(limit.maxPerProduct)}
          onChange={(e) => onChange({ ...limit, maxPerProduct: toLimit(e.target.value, 0) })}
        />
      </SettingsRow>
      <SettingsRow label={copy.overrides} description={copy.overridesHint}>
        <PickedField
          kind="products"
          ids={limit.overrides.map((o) => o.productId)}
          tabs={productTabs}
          title={copy.pickTitle}
          search={copy.search}
          labels={{ browse: copy.browse, nothingPicked: copy.nothingPicked, remove: copy.remove }}
          loadPicked={(_kind, ids) => loadPicked('products', ids, discountCopy.value, locale)}
          onChange={({ ids }) => handlePicked(ids)}
          rowExtra={(item) => (
            <Input
              inputMode="numeric"
              aria-label={copy.perProductLabel(item.title)}
              placeholder={copy.perProduct}
              value={String(limit.overrides.find((o) => o.productId === item.id)?.max ?? '')}
              onChange={(e) => handleOverride(item.id, e.target.value)}
            />
          )}
        />
      </SettingsRow>
    </SettingsCard>
  )
}
