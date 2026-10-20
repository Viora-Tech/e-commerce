import { EmptyState, Icon } from '@commerce/blocks'
import { headers } from 'next/headers'
import { notFoundContent as copy } from '@/data/search'
import { renderTemplate } from '@/lib/template-render'

/**
 * The theme's 404 template. Not-found pages get no params, so the store id comes from the proxy.
 * The browser draws it from the RSC payload (Next's error shell, or the Suspense boundary of the
 * themed reload, `lib/themed-rerender.ts`), never from server HTML: imported sections inline.
 */
export default async function StoreNotFound() {
  // Hooks
  const storeId = (await headers()).get('x-store-id')

  // Early returns
  if (!storeId) return <h1 className="page-width py-16 h2">{copy.title}</h1>

  // Render logic
  return renderTemplate(storeId, 'not_found', {
    inlineLiquid: true,
    renderers: {
      MainNotFound: () => (
        <section className="not-found page-width">
          <p className="not-found__code" aria-hidden="true">
            404
          </p>
          <EmptyState
            title={<span className="not-found__title">{copy.title}</span>}
            body={copy.body}
            action={{ label: copy.cta, href: '/collections/all' }}
          >
            <form action="/search" method="get" className="not-found__search">
              <Icon name="search" size={16} />
              <input
                type="search"
                name="q"
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
              />
            </form>
          </EmptyState>
        </section>
      ),
    },
  })
}
