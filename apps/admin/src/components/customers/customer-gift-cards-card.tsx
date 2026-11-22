'use client'

import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { customerGiftCardsContent } from '@/data/customer-gift-cards'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'

type CustomerGiftCardsCardProps = { customerId: string }

type CardRow = Awaited<ReturnType<typeof api.giftCards.forCustomer>>[number]

/**
 * The gift cards issued to this customer (#992): last four characters, balance and state, each
 * opening its card. The full code is never shown again after issue, as on Shopify.
 */
export default function CustomerGiftCardsCard({ customerId }: CustomerGiftCardsCardProps) {
  // Hooks
  const copy = useCopy(customerGiftCardsContent)
  const locale = useLocale()
  // A failed read shows no card, like a customer with none.
  const { data } = useLoad(() => api.giftCards.forCustomer({ customerId }), [customerId])

  // Early returns
  const cards: CardRow[] = data ?? []
  // No cards: no empty card on the page.
  if (cards.length === 0) return null

  // Render logic
  return (
    <DataCard title={copy.heading}>
      <ul className="flex flex-col divide-y divide-line">
        {cards.map((c) => (
          <li key={c.id} className="py-2.5 first:pt-0 last:pb-0">
            <Link
              href={routes.products.giftCard(c.id)}
              className="flex items-center justify-between gap-3 hover:underline"
            >
              <span className="min-w-0">
                <span className="block font-medium text-foreground">
                  {copy.ending(c.lastCharacters)}
                </span>
                <span className="block text-caption text-muted-foreground">
                  {copy.balance(
                    formatPaise(c.balancePaise, locale),
                    formatPaise(c.initialValuePaise, locale),
                  )}
                </span>
              </span>
              <StatusLabel kind="giftCard" value={c.state} variant="soft" />
            </Link>
          </li>
        ))}
      </ul>
    </DataCard>
  )
}
