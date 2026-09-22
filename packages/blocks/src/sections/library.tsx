import type { ComponentConfig, Fields } from '@measured/puck'
import type { ReactNode } from 'react'
import SectionFrame from '../components/section-frame'
import AnnouncementBar from '../components/sections/announcement-bar'
import CollectionList from '../components/sections/collection-list'
import Faq from '../components/sections/faq'
import FeaturedProduct from '../components/sections/featured-product'
import ImageBanner from '../components/sections/image-banner'
import ImageWithText from '../components/sections/image-with-text'
import LogoList from '../components/sections/logo-list'
import Multicolumn from '../components/sections/multicolumn'
import Newsletter from '../components/sections/newsletter'
import Testimonials from '../components/sections/testimonials'
import Video from '../components/sections/video'
import { sectionsContent as copy } from '../data/sections'
import type { CardCollection, CardProduct } from '../types'
import type { SectionMetadata } from './dynamic'

/** Collections for the collection list section, in the order the handles were given. */
export type CollectionLoader = (handles: string[]) => Promise<CardCollection[]>

/** One product, by handle, for the featured product section. */
export type SingleProductLoader = (handle: string) => Promise<CardProduct | null>

type Frame = { scheme: string; padTop: number; padBottom: number }
type Image = { url: string; alt: string }
type Link = { label: string; href: string }

const SCHEMES = [
  { label: 'Default', value: 'scheme-1' },
  { label: 'Night', value: 'scheme-2' },
  { label: 'Charcoal', value: 'scheme-3' },
  { label: 'Purple', value: 'scheme-4' },
  { label: 'Mist', value: 'scheme-5' },
]

const frame = {
  scheme: { type: 'select', label: 'Colour scheme', options: SCHEMES },
  padTop: { type: 'number', label: 'Padding top', min: 0, max: 160 },
  padBottom: { type: 'number', label: 'Padding bottom', min: 0, max: 160 },
} as const
const frameDefaults: Frame = { scheme: 'scheme-1', padTop: 48, padBottom: 48 }

const imageField = (label = 'Image') =>
  ({
    type: 'object',
    label,
    objectFields: {
      url: { type: 'text', label: 'Image URL' },
      alt: { type: 'text', label: 'Alt text' },
    },
  }) as const
const linkField = (label = 'Button') =>
  ({
    type: 'object',
    label,
    objectFields: {
      label: { type: 'text', label: 'Label' },
      href: { type: 'text', label: 'Link' },
    },
  }) as const
const noImage: Image = { url: '', alt: '' }

export type LibraryProps = {
  AnnouncementBar: { text: string; link: Link; scheme: string }
  ImageBanner: Frame & {
    image: Image
    heading: string
    text: string
    button: Link
    height: 'small' | 'medium' | 'large'
    align: 'left' | 'center'
    overlay: number
  }
  ImageWithText: Frame & {
    image: Image
    heading: string
    text: string
    button: Link
    imageFirst: boolean
  }
  Multicolumn: Frame & {
    heading: string
    columns: { title: string; text: string; image: Image }[]
  }
  CollectionList: Frame & {
    heading: string
    handles: { handle: string }[]
    resolved?: CardCollection[]
  }
  FeaturedProduct: Frame & {
    kicker: string
    handle: string
    text: string
    button: string
    resolved?: CardProduct | null
  }
  Testimonials: Frame & {
    heading: string
    items: { quote: string; author: string; role: string }[]
  }
  LogoList: Frame & { heading: string; logos: { image: Image; href: string }[] }
  Faq: Frame & { heading: string; items: { question: string; answer: string }[] }
  Video: Frame & { heading: string; url: string; poster: Image }
  Newsletter: Frame & { heading: string; text: string; button: string }
}

/**
 * A library section: its own fields plus the colour scheme and padding every
 * section shares, rendered inside the Glide section frame.
 */
function framed<P extends Frame>(
  label: string,
  fields: Record<string, unknown>,
  defaults: Omit<P, keyof Frame>,
  body: (props: P, meta: SectionMetadata) => ReactNode,
  extra: {
    defaultProps?: P
    resolveData?: (data: { props: P }) => Promise<{ props: Partial<P>; readOnly: object }>
  } = {},
): ComponentConfig {
  return {
    label,
    fields: { ...fields, ...frame } as unknown as Fields,
    defaultProps: extra.defaultProps ?? { ...frameDefaults, ...defaults },
    render: ({ puck, ...props }) => {
      const p = props as unknown as P
      return (
        <SectionFrame scheme={p.scheme} padTop={p.padTop} padBottom={p.padBottom}>
          {body(p, (puck?.metadata ?? {}) as SectionMetadata)}
        </SectionFrame>
      )
    },
    ...(extra.resolveData
      ? { resolveData: extra.resolveData as ComponentConfig['resolveData'] }
      : {}),
  } as ComponentConfig
}

type Loaders = {
  loadCollections?: CollectionLoader | undefined
  loadProduct?: SingleProductLoader | undefined
}

type LibraryConfig = Record<keyof LibraryProps, ComponentConfig>

const heading = { type: 'text', label: 'Heading' } as const

export function librarySections(loaders: Loaders): LibraryConfig {
  return {
    AnnouncementBar: {
      label: 'Announcement bar',
      fields: {
        text: { type: 'text', label: 'Text' },
        link: linkField('Link'),
        scheme: { type: 'select', label: 'Colour scheme', options: SCHEMES },
      },
      defaultProps: {
        text: copy.announcement.text,
        link: { label: copy.announcement.linkLabel, href: '/collections/all' },
        scheme: 'scheme-3',
      },
      render: ({ text, link, scheme }) => (
        <div className={scheme !== 'scheme-1' ? `color-${scheme}` : undefined}>
          <AnnouncementBar text={text} link={link} />
        </div>
      ),
    },

    ImageBanner: framed<LibraryProps['ImageBanner']>(
      'Image banner',
      {
        image: imageField(),
        heading,
        text: { type: 'textarea', label: 'Text' },
        button: linkField(),
        height: {
          type: 'select',
          label: 'Height',
          options: [
            { label: 'Small', value: 'small' },
            { label: 'Medium', value: 'medium' },
            { label: 'Large', value: 'large' },
          ],
        },
        align: {
          type: 'radio',
          label: 'Text alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
          ],
        },
        overlay: { type: 'number', label: 'Overlay opacity (%)', min: 0, max: 90 },
      },
      {
        image: noImage,
        heading: copy.imageBanner.heading,
        text: copy.imageBanner.text,
        button: { label: copy.imageBanner.button, href: '/collections/all' },
        height: 'medium',
        align: 'center',
        overlay: 30,
      },
      (p) => <ImageBanner {...p} />,
      {
        defaultProps: {
          ...frameDefaults,
          padTop: 0,
          padBottom: 0,
          image: noImage,
          heading: copy.imageBanner.heading,
          text: copy.imageBanner.text,
          button: { label: copy.imageBanner.button, href: '/collections/all' },
          height: 'medium',
          align: 'center',
          overlay: 30,
        },
      },
    ),

    ImageWithText: framed<LibraryProps['ImageWithText']>(
      'Image with text',
      {
        image: imageField(),
        heading,
        text: { type: 'textarea', label: 'Text' },
        button: linkField(),
        imageFirst: {
          type: 'radio',
          label: 'Image position',
          options: [
            { label: 'Left', value: true },
            { label: 'Right', value: false },
          ],
        },
      },
      {
        image: noImage,
        heading: copy.imageWithText.heading,
        text: copy.imageWithText.text,
        button: { label: copy.imageWithText.button, href: '/pages/about' },
        imageFirst: true,
      },
      (p) => <ImageWithText {...p} />,
    ),

    Multicolumn: framed<LibraryProps['Multicolumn']>(
      'Multicolumn',
      {
        heading,
        columns: {
          type: 'array',
          label: 'Columns',
          getItemSummary: (c: { title?: string }) => c.title || 'Column',
          arrayFields: {
            title: { type: 'text', label: 'Title' },
            text: { type: 'textarea', label: 'Text' },
            image: imageField(),
          },
        },
      },
      {
        heading: copy.multicolumn.heading,
        columns: copy.multicolumn.columns.map((c) => ({ ...c, image: noImage })),
      },
      (p) => <Multicolumn heading={p.heading} columns={p.columns} />,
    ),

    CollectionList: framed<LibraryProps['CollectionList']>(
      'Collection list',
      {
        heading,
        handles: {
          type: 'array',
          label: 'Collections',
          getItemSummary: (c: { handle?: string }) => c.handle || 'Collection',
          arrayFields: { handle: { type: 'text', label: 'Collection handle' } },
        },
      },
      { heading: copy.collectionList.heading, handles: [] },
      (p) => (
        <CollectionList
          heading={p.heading}
          collections={p.resolved ?? []}
          empty={copy.collectionList.empty}
        />
      ),
      {
        resolveData: async ({ props }) => ({
          props: {
            resolved: loaders.loadCollections
              ? await loaders.loadCollections(props.handles.map((h) => h.handle).filter(Boolean))
              : [],
          },
          readOnly: { resolved: true },
        }),
      },
    ),

    FeaturedProduct: framed<LibraryProps['FeaturedProduct']>(
      'Featured product',
      {
        kicker: { type: 'text', label: 'Kicker' },
        handle: { type: 'text', label: 'Product handle' },
        text: { type: 'textarea', label: 'Text' },
        button: { type: 'text', label: 'Button label' },
      },
      {
        kicker: copy.featuredProduct.kicker,
        handle: '',
        text: '',
        button: copy.featuredProduct.button,
      },
      (p) => (
        <FeaturedProduct
          kicker={p.kicker}
          text={p.text}
          button={p.button}
          product={p.resolved ?? null}
          empty={copy.featuredProduct.empty}
        />
      ),
      {
        resolveData: async ({ props }) => ({
          props: {
            resolved:
              props.handle && loaders.loadProduct ? await loaders.loadProduct(props.handle) : null,
          },
          readOnly: { resolved: true },
        }),
      },
    ),

    Testimonials: framed<LibraryProps['Testimonials']>(
      'Testimonials',
      {
        heading,
        items: {
          type: 'array',
          label: 'Testimonials',
          getItemSummary: (t: { author?: string }) => t.author || 'Testimonial',
          arrayFields: {
            quote: { type: 'textarea', label: 'Quote' },
            author: { type: 'text', label: 'Name' },
            role: { type: 'text', label: 'Detail' },
          },
        },
      },
      {
        heading: copy.testimonials.heading,
        items: copy.testimonials.items.map((t) => ({ ...t })),
      },
      (p) => <Testimonials heading={p.heading} items={p.items} />,
    ),

    LogoList: framed<LibraryProps['LogoList']>(
      'Logo list',
      {
        heading,
        logos: {
          type: 'array',
          label: 'Logos',
          getItemSummary: (l: { image?: Image }) => l.image?.alt || 'Logo',
          arrayFields: { image: imageField('Logo'), href: { type: 'text', label: 'Link' } },
        },
      },
      { heading: copy.logoList.heading, logos: [] },
      (p) => <LogoList heading={p.heading} logos={p.logos} />,
    ),

    Faq: framed<LibraryProps['Faq']>(
      'FAQ',
      {
        heading,
        items: {
          type: 'array',
          label: 'Questions',
          getItemSummary: (q: { question?: string }) => q.question || 'Question',
          arrayFields: {
            question: { type: 'text', label: 'Question' },
            answer: { type: 'textarea', label: 'Answer' },
          },
        },
      },
      { heading: copy.faq.heading, items: copy.faq.items.map((q) => ({ ...q })) },
      (p) => <Faq heading={p.heading} items={p.items} />,
    ),

    Video: framed<LibraryProps['Video']>(
      'Video',
      {
        heading,
        url: { type: 'text', label: 'Video link' },
        poster: imageField('Cover image'),
      },
      { heading: copy.video.heading, url: '', poster: noImage },
      (p) => <Video heading={p.heading} url={p.url} poster={p.poster} empty={copy.video.empty} />,
    ),

    Newsletter: framed<LibraryProps['Newsletter']>(
      'Email signup',
      {
        heading,
        text: { type: 'textarea', label: 'Text' },
        button: { type: 'text', label: 'Button label' },
      },
      {
        heading: copy.newsletter.heading,
        text: copy.newsletter.text,
        button: copy.newsletter.button,
      },
      (p, meta) => (
        <Newsletter
          heading={p.heading}
          text={p.text}
          button={p.button}
          action={meta.newsletterAction}
        />
      ),
    ),
  }
}
