import type { ReactNode } from 'react'
import { heroCarouselContent as copy } from '../data/glide/hero-carousel'
import { type FocalPoint, focalStyle } from '../focal-point'
import { linkTarget } from '../link'
import { safeHref } from '../slot-types'
import type { CardProduct, MediaImage } from '../types'
import { safeVideoFile } from '../video-url'
import CountdownTiles from './countdown-tiles'
import HeroChip from './hero-chip'
import Picture from './picture'

export type HeroImage = {
  url: string
  alt: string
  focal?: FocalPoint | undefined
  /** Filled in by the storefront from the media library; see `attachImageMedia`. */
  variants?: MediaImage['variants']
  thumbhash?: MediaImage['thumbhash']
}

type HeroLink = { label: string; href: string; newTab?: boolean | undefined }

/**
 * One slide as the carousel draws it. Only `heading` and `image` were ever required, so slides
 * saved before the Glide refresh (`heading`, `subheading`, `image`, `cta`, `cta2`,
 * `textPosition`) still draw as full-bleed picture slides. Text may arrive as React nodes
 * while it is being edited on the canvas.
 */
export type HeroSlide = {
  kind?: 'image' | 'video' | undefined
  layout?: 'full_bleed' | 'split' | undefined
  mediaSide?: 'left' | 'right' | undefined
  metaLabel?: ReactNode
  scheme?: 'dark' | 'brand' | 'light' | undefined
  heading: ReactNode
  subheading?: ReactNode
  image: HeroImage
  mobileImage?: HeroImage | undefined
  videoUrl?: string | undefined
  poster?: HeroImage | undefined
  /** The product picked for the slide, already loaded; null when it was not found. */
  product?: CardProduct | null | undefined
  showChip?: boolean | undefined
  chipStyle?: 'card' | 'inline' | 'bar' | undefined
  cta?: HeroLink | undefined
  cta2?: HeroLink | undefined
  textPosition?: 'left' | 'center' | 'right' | undefined
  link?: string | undefined
  deadline?: string | undefined
}

type HeroSlideProps = {
  slide: HeroSlide
  index: number
  total: number
  active: boolean
  showCounter: boolean
  wordEntrance: boolean
  lowStockThreshold: number
  /** The aria-hidden loop copy of slide one: no ids, no h1, nothing focusable. */
  clone?: boolean | undefined
}

const COUNTDOWN = {
  root: 'hero-carousel__countdown',
  tile: 'countdown__tile',
  value: 'countdown__value',
  label: 'countdown__label',
}

const twoDigits = (n: number) => String(n).padStart(2, '0')

const hasImage = (image: HeroImage | undefined): image is HeroImage => Boolean(image?.url)

/** Words get their own spans for the per-word entrance; a node being edited stays whole. */
function headingBody(heading: ReactNode, split: boolean): ReactNode {
  if (!split || typeof heading !== 'string') return heading
  return heading
    .split(' ')
    .filter(Boolean)
    .flatMap((word, i, all) => [
      // biome-ignore lint/suspicious/noArrayIndexKey: words of one heading, re-split on every render.
      <span key={`w${i}`} className="hero-carousel__word">
        {word}
      </span>,
      i < all.length - 1 ? ' ' : null,
    ])
}

// One slide of sections/hero-carousel.liquid: video or picture (uploaded, or the picked product's
// own), full-bleed under a raked scrim or split beside a colour field, then the copy: counter and
// label, heading (the page's h1 on slide one), subheading, countdown, buttons, product box.
export default function HeroSlideView({
  slide,
  index,
  total,
  active,
  showCounter,
  wordEntrance,
  lowStockThreshold,
  clone,
}: HeroSlideProps) {
  // Render logic
  const layout = slide.layout ?? 'full_bleed'
  const scheme = slide.scheme ?? 'dark'
  const pos = slide.textPosition ?? 'left'
  const first = index === 0 && !clone
  const productImage = slide.product?.images.find((i) => i.url)
  const image: HeroImage | undefined = hasImage(slide.image)
    ? slide.image
    : productImage
      ? { ...productImage, alt: productImage.alt ?? slide.product?.title ?? '' }
      : undefined
  const video = slide.kind === 'video' ? safeVideoFile(slide.videoUrl ?? '') : null
  const poster = hasImage(slide.poster) ? slide.poster.url : undefined
  const hasMedia = Boolean(video || image)
  const showChip = Boolean(slide.product && slide.showChip !== false)
  const ctas = [slide.cta, slide.cta2].filter((c): c is HeroLink => Boolean(c?.label))
  const showMeta = (showCounter && total > 1) || Boolean(slide.metaLabel)
  const hasContent = Boolean(
    slide.heading || slide.subheading || ctas.length || slide.deadline || showChip || showMeta,
  )
  const slideHref = !ctas.length && !showChip ? safeHref(slide.link) : null
  const sizes = layout === 'split' ? '(min-width: 750px) 50vw, 100vw' : '100vw'
  const eager = first ? 'eager' : 'lazy'
  const Wrap = slideHref ? 'a' : 'div'
  const Heading = first ? 'h1' : 'h2'
  const fieldClass = `hero-carousel__field hero-carousel__field--${scheme}`
  const fieldScheme = scheme === 'light' ? undefined : 'dark'
  const media = video ? (
    <video
      className="hero-carousel__video"
      src={video}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload={first ? 'auto' : 'metadata'}
    />
  ) : image ? (
    <>
      <Picture
        image={image}
        alt={image.alt}
        className={`hero-carousel__image${hasImage(slide.mobileImage) ? ' max-[46.8125rem]:hidden' : ''}`}
        style={focalStyle(image.focal)}
        fill
        loading={eager}
        fetchPriority={first ? 'high' : undefined}
        sizes={sizes}
      />
      {hasImage(slide.mobileImage) ? (
        <Picture
          image={slide.mobileImage}
          alt={slide.mobileImage.alt || image.alt}
          className="hero-carousel__image min-[46.875rem]:hidden"
          style={focalStyle(slide.mobileImage.focal)}
          fill
          loading={eager}
          sizes="100vw"
        />
      ) : null}
    </>
  ) : null
  const content = (
    <>
      {showMeta ? (
        <p className="hero-carousel__meta text-caption">
          {showCounter && total > 1 ? (
            <span className="hero-carousel__meta-count">
              {copy.counter(twoDigits(index + 1), twoDigits(total))}
            </span>
          ) : null}
          {slide.metaLabel ? (
            <>
              <span className="hero-carousel__meta-rule" aria-hidden="true" />
              <span className="hero-carousel__meta-label">{slide.metaLabel}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {slide.heading ? (
        <Heading className="hero-carousel__heading h1">
          {headingBody(slide.heading, wordEntrance)}
        </Heading>
      ) : first && slide.product ? (
        <h1 className="visually-hidden">{slide.product.title}</h1>
      ) : null}
      {slide.subheading ? (
        <p className="hero-carousel__subheading text-body">{slide.subheading}</p>
      ) : null}
      {slide.deadline ? (
        <CountdownTiles deadline={slide.deadline} labels={copy.countdown} classes={COUNTDOWN} />
      ) : null}
      {ctas.length ? (
        <div className="hero-carousel__ctas">
          {ctas.map((cta, i) => (
            <a
              key={cta.href + String(i)}
              href={safeHref(cta.href) ?? '#'}
              {...linkTarget(cta)}
              className={
                i === 0 && cta === slide.cta
                  ? 'btn btn--primary'
                  : 'btn btn--secondary hero-carousel__cta-secondary'
              }
            >
              {cta.label}
            </a>
          ))}
        </div>
      ) : null}
      {showChip && slide.product ? (
        <HeroChip
          product={slide.product}
          style={slide.chipStyle ?? 'card'}
          hasHeading={Boolean(slide.heading)}
          lowStockThreshold={lowStockThreshold}
        />
      ) : null}
    </>
  )
  const contentClass = `hero-carousel__content hero-carousel__content--${pos}`

  return (
    <Wrap
      className={`hero-carousel__slide hero-carousel__slide--${layout}${layout === 'split' ? ` hero-carousel__slide--media-${slide.mediaSide ?? 'right'}` : ''}${active ? ' is-active' : ''}`}
      href={slideHref ?? undefined}
      aria-hidden={clone ? true : undefined}
      inert={clone ? true : undefined}
      data-hero-clone={clone ? '' : undefined}
    >
      {layout === 'split' ? (
        <div className="hero-carousel__split">
          {hasMedia ? (
            <div className="hero-carousel__pane hero-carousel__pane--media">{media}</div>
          ) : null}
          <div
            className={`hero-carousel__pane hero-carousel__pane--text ${fieldClass}${hasMedia ? '' : ' hero-carousel__pane--full'}`}
            data-color-scheme={fieldScheme}
          >
            {hasContent ? (
              <div className={`${contentClass} hero-carousel__content--split`}>{content}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {hasMedia ? <div className="hero-carousel__media">{media}</div> : null}
          {hasContent && !hasMedia ? (
            <div
              className={`hero-carousel__flat-bg ${fieldClass}`}
              data-color-scheme={fieldScheme}
            />
          ) : null}
          {hasContent && hasMedia ? (
            <div className={`hero-carousel__scrim hero-carousel__scrim--${pos}`} />
          ) : null}
          {hasContent ? (
            <div
              className={`${contentClass}${hasMedia ? '' : ` hero-carousel__content--flat hero-carousel__content--on-${scheme}`}`}
            >
              {content}
            </div>
          ) : null}
        </>
      )}
    </Wrap>
  )
}
