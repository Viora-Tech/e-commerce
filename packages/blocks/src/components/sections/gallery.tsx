// Pattern after shadcnblocks' Gallery (our own implementation). See THIRD_PARTY_NOTICES.md.
import type { Image, Link } from '../../sections/framed'

type GalleryImage = { image: Image; caption: string; link: Link }

type GalleryProps = {
  heading: string
  layout: 'grid' | 'masonry' | 'carousel'
  images: GalleryImage[]
}

const PLACEHOLDER_GRADIENT =
  'linear-gradient(135deg,color-mix(in_oklab,var(--color-brand)_22%,transparent),color-mix(in_oklab,var(--color-accent)_18%,transparent))'

const LAYOUT_CLASS: Record<GalleryProps['layout'], string> = {
  grid: 'grid grid-cols-2 gap-[1rem] md:grid-cols-4',
  masonry: 'columns-2 gap-[1rem] md:columns-4 [&>*]:mb-[1rem] [&>*]:break-inside-avoid',
  carousel:
    'flex snap-x snap-mandatory gap-[1rem] overflow-x-auto pb-[0.5rem] md:grid md:grid-cols-4 md:overflow-visible',
}

export default function Gallery({ heading, layout, images }: GalleryProps) {
  return (
    <div className="page-width">
      {heading ? <h2 className="h2 text-[var(--color-ink)]">{heading}</h2> : null}
      <div className={`mt-[1.5rem] ${LAYOUT_CLASS[layout]}`}>
        {images.map((item, i) => {
          const figure = (
            <figure
              className={`group relative w-full shrink-0 overflow-hidden rounded-[var(--radius-card)] ${
                layout === 'carousel' ? 'w-[70%] snap-start md:w-full' : ''
              }`}
            >
              {item.image?.url ? (
                <img
                  src={item.image.url}
                  alt={item.image.alt}
                  loading="lazy"
                  className="aspect-[4/5] size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                />
              ) : (
                <div
                  aria-hidden
                  className="aspect-[4/5] size-full transition-transform duration-300 ease-out group-hover:scale-105"
                  style={{ backgroundImage: PLACEHOLDER_GRADIENT }}
                />
              )}
              {item.caption ? (
                <figcaption className="text-small absolute inset-x-0 bottom-0 bg-[color-mix(in_oklab,var(--color-ink)_60%,transparent)] px-[0.75rem] py-[0.5rem] text-[var(--color-bg)]">
                  {item.caption}
                </figcaption>
              ) : null}
            </figure>
          )
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <div key={`${item.image?.url ?? item.caption}-${i}`}>
              {item.link?.href ? <a href={item.link.href}>{figure}</a> : figure}
            </div>
          )
        })}
      </div>
    </div>
  )
}
