import { type CardProduct, ProductCard } from '@commerce/blocks'
import { searchContent as copy } from '@/data/search'

type MainSearchProps = { query: string; products: CardProduct[] }

/** The search template's main section: the search form and matching products. */
export default function MainSearch({ query, products }: MainSearchProps) {
  // Render logic
  return (
    <section className="page-width py-12">
      <h1 className="h2 mb-6">{copy.title}</h1>
      <search className="mb-8 block max-w-xl">
        <form action="/search" method="get" className="flex gap-3">
          <label htmlFor="search-q" className="visually-hidden">
            {copy.label}
          </label>
          <input
            id="search-q"
            className="field__input flex-1"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={copy.placeholder}
          />
          <button className="btn btn--primary" type="submit">
            {copy.submit}
          </button>
        </form>
      </search>
      {query ? <p className="text-caption mb-6">{copy.results(products.length, query)}</p> : null}
      {query && products.length === 0 ? <p className="text-body">{copy.empty}</p> : null}
      <div className="tabbed-products__grid" style={{ '--columns': 4 } as React.CSSProperties}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
