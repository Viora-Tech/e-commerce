import type { HomeCard } from '@commerce/core/home-cards'
import { homePageContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import { routes } from '@/lib/routes'
import type { HomeSignals } from './home-signals'
import SuggestionCards, { type Suggestion } from './suggestion-cards'

type SuggestionsProps = {
  /** The store's smart cards (rebuilt daily); null when the member cannot read analytics. */
  cards: HomeCard[] | null
  /** Null when the member cannot read apps: the app-based suggestions are skipped. */
  signals: HomeSignals | null
}

const MAX = 6

type Copy = (typeof homePageContent)['suggest']

/** The orders list on its Unfulfilled tab. */
const UNFULFILLED = `${routes.orders.list()}?status=unfulfilled`

/** A new segment pre-filled with "2 or more orders". */
function repeatSegmentHref(name: string): string {
  const rules = { match: 'all', conditions: [{ field: 'orders', op: 'gte', value: '2' }] }
  const q = new URLSearchParams({ name, rules: JSON.stringify(rules) })
  return `${routes.customers.newSegment()}?${q.toString()}`
}

/** One stored card in words: copy, picture and its one action. */
function toSuggestion(card: HomeCard, c: Copy, money: (paise: number) => string): Suggestion {
  const base = { id: card.key, cardKey: card.key, imageUrl: null, prompt: null }
  switch (card.kind) {
    case 'weak_product_page':
      return {
        ...base,
        icon: 'page',
        title: c.weakPageTitle(card.title),
        body: c.weakPageBody(card.sessions, card.addToCarts),
        cta: c.weakPageCta,
        href: routes.products.detail(card.productId),
        imageUrl: card.imageUrl,
      }
    case 'stale_collection':
      return {
        ...base,
        icon: 'collection',
        title: c.staleTitle(card.title),
        body: card.reason === 'year' ? c.staleYearBody : c.staleSeasonBody,
        cta: c.staleCta,
        href: routes.products.collection(card.collectionId),
        imageUrl: card.imageUrl,
      }
    case 'repeat_buyers':
      return {
        ...base,
        icon: 'segment',
        title: c.repeatTitle(card.customers),
        body: c.repeatBody,
        cta: c.repeatCta,
        href: repeatSegmentHref(c.repeatSegmentName),
      }
    case 'restock_bestseller':
      return {
        ...base,
        icon: 'stock',
        title: c.restockTitle(card.title),
        body: c.restockBody(card.unitsSold, card.available, card.daysLeft),
        cta: c.restockCta,
        href: routes.products.detail(card.productId),
        imageUrl: card.imageUrl,
      }
    case 'old_unfulfilled':
      return {
        ...base,
        icon: 'orders',
        title: c.unfulfilledTitle(card.orders),
        body: c.unfulfilledBody(card.oldestDays),
        cta: c.unfulfilledCta,
        href: UNFULFILLED,
      }
    case 'abandoned_checkouts':
      return {
        ...base,
        icon: 'cart',
        title: c.abandonedTitle,
        body: c.abandonedBody(card.carts, money(card.valuePaise)),
        cta: c.abandonedCta,
        href: routes.orders.abandonedCheckouts(),
      }
    case 'product_trending':
      return {
        ...base,
        icon: 'trend',
        title: c.trendingTitle(card.title, card.percent),
        body: c.trendingBody(money(card.revenuePaise)),
        cta: c.trendingCta,
        href: routes.products.detail(card.productId),
        prompt: c.trendingPrompt(card.title, card.percent),
        imageUrl: card.imageUrl,
      }
  }
}

/**
 * "Suggested for you" (#101): the store's smart cards, built daily from its own numbers by
 * `@commerce/core` home-cards (a product page nobody adds to cart, a festival collection still
 * live, repeat buyers without a segment…). Set-up ideas from the store's apps fill any room
 * left. Smart cards are dismissed for the whole store; the set-up ones per browser.
 */
export default async function Suggestions({ cards, signals }: SuggestionsProps) {
  // Render logic
  const c = (await getCopy(homePageContent)).suggest
  const fmt = formatters(await getLocale())
  const items: Suggestion[] = (cards ?? []).map((card) => toSuggestion(card, c, fmt.money))

  if (signals && !signals.whatsappConnected) {
    items.push({
      id: 'whatsapp',
      cardKey: null,
      icon: 'whatsapp',
      title: c.whatsappTitle,
      body: c.whatsappBody,
      cta: c.whatsappCta,
      href: routes.apps.connect('whatsapp'),
      prompt: null,
      imageUrl: null,
    })
  }
  if (signals && !signals.reviewsInstalled) {
    items.push({
      id: 'reviews',
      cardKey: null,
      icon: 'star',
      title: c.reviewsTitle,
      body: c.reviewsBody,
      cta: c.reviewsCta,
      href: routes.apps.install('reviews'),
      prompt: null,
      imageUrl: null,
    })
  }

  return (
    <SuggestionCards
      suggestions={items.slice(0, MAX)}
      title={c.title}
      note={c.note}
      dismissLabel={c.dismiss}
      hiddenMessage={c.hidden}
      undoLabel={c.undo}
    />
  )
}
