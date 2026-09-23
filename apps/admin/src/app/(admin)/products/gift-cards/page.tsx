import type { Metadata } from 'next'
import { GIFT_CARD_STATES } from '@/data/gift-cards'
import { appRouter, call, serverContext } from '@/lib/api'
import { LIST_PER_PAGE, parseListQuery, type SearchParams } from '@/lib/list-query'
import GiftCardsPage from './gift-cards-page'

export const metadata: Metadata = { title: 'Gift cards' }

type Props = { searchParams: Promise<SearchParams> }

export default async function Page({ searchParams }: Props) {
  const query = parseListQuery(await searchParams, GIFT_CARD_STATES)
  const context = await serverContext()
  const [result, all, products, settings] = await Promise.all([
    call(
      appRouter.giftCards.list,
      {
        page: query.page,
        perPage: LIST_PER_PAGE,
        q: query.query || undefined,
        state: query.status ?? undefined,
      },
      { context },
    ),
    call(appRouter.giftCards.list, { page: 1, perPage: 1 }, { context }),
    call(appRouter.giftCards.products, undefined, { context }),
    call(appRouter.giftCards.settings, undefined, { context }),
  ])

  return <GiftCardsPage initial={{ query, result, allCount: all.total, products, settings }} />
}
