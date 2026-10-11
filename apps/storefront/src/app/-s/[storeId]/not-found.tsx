import { headers } from 'next/headers'
import { notFoundContent as copy } from '@/data/search'
import { renderTemplate } from '@/lib/template-render'

/** The theme's 404 template. Not-found pages get no params, so the store id comes from the proxy. */
export default async function StoreNotFound() {
  // Hooks
  const storeId = (await headers()).get('x-store-id')

  // Early returns
  if (!storeId) return <h1 className="page-width py-16 h2">{copy.title}</h1>

  // Render logic
  return renderTemplate(storeId, 'not_found', {
    renderers: {
      MainNotFound: () => (
        <section className="page-width py-24 text-center">
          <h1 className="h2 mb-4">{copy.title}</h1>
          <p className="text-body mb-8">{copy.body}</p>
          <a href="/collections/all" className="btn btn--primary">
            {copy.cta}
          </a>
        </section>
      ),
    },
  })
}
