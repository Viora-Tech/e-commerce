import type { DashboardSummary } from '@commerce/api'
import { homePageContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import { routes } from '@/lib/routes'
import type { HomeSignals } from './home-signals'
import SuggestionCards, { type Suggestion } from './suggestion-cards'

type SuggestionsProps = {
  summary: DashboardSummary
  /** Null when the member cannot read apps: the app-based suggestions are skipped. */
  signals: HomeSignals | null
  /** Carts left behind this week; null when the member cannot read orders. */
  abandoned: { carts: number; valuePaise: number } | null
}

const MAX = 4

/**
 * "Suggested for you": rules over real store data, never a canned list. A rule fires only
 * when its data exists (a best seller that is nearly out, carts left behind, an app not yet
 * set up). Dismissing is per browser, handled by `SuggestionCards`.
 */
export default async function Suggestions({ summary, signals, abandoned }: SuggestionsProps) {
  // Render logic
  const c = (await getCopy(homePageContent)).suggest
  const fmt = formatters(await getLocale())
  const items: Suggestion[] = []

  const best = summary.insight.bestSeller
  const low = best ? summary.lowStock.find((l) => l.title === best.title) : undefined
  if (best && low) {
    items.push({
      id: 'restock',
      icon: 'stock',
      title: c.restockTitle,
      body: c.restockBody(best.title, best.units, low.available),
      cta: c.restockCta,
      href: routes.products.inventory(),
      imageUrl: low.imageUrl,
    })
  }
  if (abandoned && abandoned.carts > 0 && abandoned.valuePaise > 0) {
    items.push({
      id: 'abandoned',
      icon: 'cart',
      title: c.abandonedTitle,
      body: c.abandonedBody(abandoned.carts, fmt.money(abandoned.valuePaise)),
      cta: c.abandonedCta,
      href: routes.orders.abandonedCheckouts(),
      imageUrl: null,
    })
  }
  if (signals && !signals.whatsappConnected) {
    items.push({
      id: 'whatsapp',
      icon: 'whatsapp',
      title: c.whatsappTitle,
      body: c.whatsappBody,
      cta: c.whatsappCta,
      href: routes.apps.connect('whatsapp'),
      imageUrl: null,
    })
  }
  if (signals && !signals.reviewsInstalled) {
    items.push({
      id: 'reviews',
      icon: 'star',
      title: c.reviewsTitle,
      body: c.reviewsBody,
      cta: c.reviewsCta,
      href: routes.apps.list(),
      imageUrl: null,
    })
  }
  // Figma 226:565 always shows four: two ideas that suit every store fill the row.
  items.push(
    {
      id: 'describe',
      icon: 'ai',
      title: c.describeTitle,
      body: c.describeBody,
      cta: c.describeCta,
      href: routes.products.list(),
      imageUrl: null,
    },
    {
      id: 'sale',
      icon: 'sale',
      title: c.saleTitle,
      body: c.saleBody,
      cta: c.saleCta,
      href: routes.discounts.new(),
      imageUrl: null,
    },
  )

  return (
    <SuggestionCards
      suggestions={items.slice(0, MAX)}
      title={c.title}
      note={c.note}
      dismissLabel={c.dismiss}
    />
  )
}
