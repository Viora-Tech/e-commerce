'use client'

import type { CheckoutBranding } from '@commerce/core/checkout-settings'
import { ShoppingCart, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import CheckoutBrandingPreview from '@/components/settings/checkout-branding-preview'
import CheckoutBrandingSettings from '@/components/settings/checkout-branding-settings'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'

type RolloutBrandingChangeProps = {
  branding: CheckoutBranding
  orderNotes: boolean
  storeName: string
  /** A running or ended rollout shows its branding without changing it. */
  disabled: boolean
  onChange: (branding: CheckoutBranding) => void
  onRemove: () => void
}

/** The checkout look the rollout puts in place, edited like Settings → Checkout → Branding. */
export default function RolloutBrandingChange({
  branding,
  orderNotes,
  storeName,
  disabled,
  onChange,
  onRemove,
}: RolloutBrandingChangeProps) {
  // Hooks
  const { checkout: copy, changes } = useCopy(rolloutsContent).form

  return (
    <DataCard
      title={copy.heading}
      icon={<ShoppingCart aria-hidden="true" className="size-4 text-muted-foreground" />}
      action={
        disabled ? null : (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden="true" />
            {changes.remove}
          </Button>
        )
      }
    >
      {disabled ? (
        <CheckoutBrandingPreview
          branding={branding}
          orderNotes={orderNotes}
          device="desktop"
          storeName={storeName}
        />
      ) : (
        <CheckoutBrandingSettings
          branding={branding}
          orderNotes={orderNotes}
          storeName={storeName}
          onBranding={(patch) => onChange({ ...branding, ...patch })}
        />
      )}
    </DataCard>
  )
}
