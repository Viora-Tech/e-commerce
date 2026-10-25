/**
 * Shopify gift cards. The Admin API never returns a card's full code, only
 * its last characters, so what comes over is the balance, expiry and owner;
 * `write-gift-cards.ts` decides what to do without the code.
 */
import type { ShopifyClient } from './shopify-client'
import type { NGiftCard } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

const GIFT_CARDS_QUERY = `query GiftCards($cursor: String) {
  giftCards(first: 100, after: $cursor, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id lastCharacters enabled expiresOn note
      balance { amount currencyCode }
      initialValue { amount }
      customer { id email firstName lastName }
    }
  }
}`

type GGiftCard = {
  id: string
  lastCharacters: string
  enabled: boolean
  expiresOn: string | null
  note: string | null
  balance: { amount: string; currencyCode: string }
  initialValue: { amount: string }
  customer: {
    id: string
    email: string | null
    firstName: string | null
    lastName: string | null
  } | null
}

const paise = (amount: string) => Math.round(Number(amount) * 100)

function mapGiftCard(g: GGiftCard): NGiftCard {
  return {
    sourceId: g.id,
    lastCharacters: g.lastCharacters,
    balancePaise: paise(g.balance.amount),
    initialPaise: paise(g.initialValue.amount),
    currency: g.balance.currencyCode,
    enabled: g.enabled,
    expiresOn: g.expiresOn,
    note: g.note || null,
    customer: g.customer
      ? {
          sourceId: g.customer.id,
          email: g.customer.email?.toLowerCase() || null,
          name: [g.customer.firstName, g.customer.lastName].filter(Boolean).join(' ') || null,
        }
      : null,
  }
}

export async function* fetchGiftCards(client: ShopifyClient): AsyncGenerator<NGiftCard[]> {
  for await (const nodes of client.paginate<GGiftCard>(
    GIFT_CARDS_QUERY,
    (d) => (d as { giftCards: Page<GGiftCard> }).giftCards,
    {},
    250,
  )) {
    yield nodes.map(mapGiftCard)
  }
}
