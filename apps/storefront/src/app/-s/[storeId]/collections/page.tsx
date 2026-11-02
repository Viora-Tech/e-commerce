import { Icon } from '@commerce/blocks'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { collectionsContent as copy } from '@/data/collections'
import { listCollections } from '@/lib/collections'
import { marketCanonical } from '@/lib/seo'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: copy.indexTitle,
    alternates: { canonical: await marketCanonical('/collections') },
  }
}

export default async function CollectionsIndex({ params }: Params) {
  const { storeId } = await params
  const collections = await inStore(storeId, (tx) => listCollections(tx))

  return (
    <section className="section-collection page-width">
      <header className="collection__header">
        <h1 className="collection__title">{copy.indexTitle}</h1>
        <p className="collection__description">{copy.indexIntro}</p>
      </header>
      {collections.length === 0 ? (
        <p className="text-body">{copy.emptyIndex}</p>
      ) : (
        <ul className="collection-list__grid collection__index-grid">
          {collections.map((c) => (
            <li key={c.handle}>
              <Link href={`/collections/${c.handle}`} className="collection-list__card">
                <span className="collection-list__media">
                  {c.imageUrl ? <Image src={c.imageUrl} alt="" width={480} height={480} /> : null}
                </span>
                <span className="collection-list__info">
                  <span className="collection-list__text">
                    <span className="collection-list__title">{c.title}</span>
                    <span className="collection-list__count">
                      {copy.productCount(c.productCount)}
                    </span>
                  </span>
                  <Icon name="arrow-right" size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
