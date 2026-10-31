'use client'

import {
  Clock,
  CreditCard,
  type IconComponent,
  Settings,
  SlidersHorizontal,
} from '@commerce/ui/icons'
import type { DrillRow } from '@/components/settings/settings-drill'
import { useDrillNav } from '@/components/settings/settings-drill'
import SettingsLinkRow from '@/components/settings/settings-link-row'
import { paymentProvidersContent } from '@/data/payment-providers'
import { useCopy } from '@/hooks/use-copy'
import { CONFIG_ROWS, PAYMENT_ROWS } from './payments-rows'
import PaymentsSection from './payments-section'

type ConfigSectionProps = {
  /** Every drill row; the configuration ones are shown, in `CONFIG_ROWS` order. */
  rows: readonly DrillRow[]
}

const ICONS: Record<(typeof CONFIG_ROWS)[number], IconComponent> = {
  [PAYMENT_ROWS.capture]: Clock,
  [PAYMENT_ROWS.rules]: SlidersHorizontal,
  [PAYMENT_ROWS.methods]: CreditCard,
  [PAYMENT_ROWS.more]: Settings,
}

/**
 * "Payment configuration": capture, payment method customizations, supported methods and More,
 * each an icon row with its current value that opens its detail in place (`?open=`).
 */
export default function ConfigSection({ rows }: ConfigSectionProps) {
  // Hooks
  const { overview } = useCopy(paymentProvidersContent)
  const open = useDrillNav()

  return (
    <PaymentsSection
      id="payments-config"
      heading={overview.config.heading}
      description={overview.config.help}
    >
      {CONFIG_ROWS.flatMap((id) => {
        const row = rows.find((r) => r.id === id)
        if (!row) return []
        const Icon = ICONS[id]
        return [
          <li key={id}>
            <SettingsLinkRow
              onClick={() => open(id)}
              leading={
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4"
                >
                  <Icon />
                </span>
              }
              title={row.title}
              value={row.value}
            />
          </li>,
        ]
      })}
    </PaymentsSection>
  )
}
