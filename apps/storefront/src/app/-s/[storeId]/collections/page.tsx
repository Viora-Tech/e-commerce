import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { collectionsContent as copy } from '@/data/collections'
import { listCollections } from '@/lib/collections'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = {
  title: copy.indexTitle,
  alternates: { canonical: '/collections' },
}

export default async function CollectionsIndex({ params }: Params) {
  const { storeId } = await params
  const collections = await inStore(storeId, (tx) => listCollections(tx))

  return (
    <section className="section-collection page-width">
      <header className="collection__header">
        <h1 className="collection__title h2">{copy.indexTitle}</h1>
        <p className="collection__intro text-body">{copy.indexIntro}</p>
      </header>
      {collections.length === 0 ? (
        <p className="text-body">{copy.emptyIndex}</p>
      ) : (
        <div className="collection__index">
          {collections.map((c) => (
            <Link key={c.handle} href={`/collections/${c.handle}`} className="collection__tile">
              {c.imageUrl ? (
                <Image
                  className="collection__tile-image"
                  src={c.imageUrl}
                  alt=""
                  width={480}
                  height={320}
                />
              ) : null}
              <span className="collection__tile-title">{c.title}</span>
              <span className="collection__tile-count text-caption">
                {copy.productCount(c.productCount)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
