import type { ComponentConfig } from '@puckeditor/core'
import CollectionList from '../components/sections/collection-list'
import Faq from '../components/sections/faq'
import ImageBanner from '../components/sections/image-banner'
import ImageWithText from '../components/sections/image-with-text'
import LogoList from '../components/sections/logo-list'
import Multicolumn from '../components/sections/multicolumn'
import Testimonials from '../components/sections/testimonials'
import Video from '../components/sections/video'
import { sectionsContent as copy } from '../data/sections'
import { defaultSectionSettings } from '../section-settings'
import type { CardCollection, CardProduct } from '../types'
import { type Frame, framed, type Image, imageField, type Link, linkField, noImage } from './framed'
import { type AnnouncementBarProps, announcementBarSection } from './glide/announcement-bar'
import { type FeaturedProductProps, featuredProductSection } from './glide/featured-product'
import { type NewsletterProps, newsletterSection } from './glide/newsletter'

/** Collections for the collection list section, in the order the handles were given. */
export type CollectionLoader = (handles: string[]) => Promise<CardCollection[]>

/** One product, by handle, for the featured product section. */
export type SingleProductLoader = (handle: string) => Promise<CardProduct | null>

export type LibraryProps = {
  AnnouncementBar: AnnouncementBarProps
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
  FeaturedProduct: FeaturedProductProps
  Testimonials: Frame & {
    heading: string
    items: { quote: string; author: string; role: string }[]
  }
  LogoList: Frame & { heading: string; logos: { image: Image; href: string }[] }
  Faq: Frame & { heading: string; items: { question: string; answer: string }[] }
  Video: Frame & { heading: string; url: string; poster: Image }
  Newsletter: NewsletterProps
}

type Loaders = {
  loadCollections?: CollectionLoader | undefined
  loadProduct?: SingleProductLoader | undefined
}

type LibraryConfig = Record<keyof LibraryProps, ComponentConfig>

const heading = { type: 'text', label: 'Heading' } as const

export function librarySections(loaders: Loaders): LibraryConfig {
  return {
    AnnouncementBar: announcementBarSection(),

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
          settings: defaultSectionSettings({ padTop: 0, padBottom: 0 }),
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
              ? await loaders.loadCollections(
                  (props.handles ?? []).map((h) => h.handle).filter(Boolean),
                )
              : [],
          },
          readOnly: { resolved: true },
        }),
      },
    ),

    // Glide's featured-product section; config in ./glide/featured-product.tsx.
    FeaturedProduct: featuredProductSection(loaders),

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

    Newsletter: newsletterSection(),
  }
}
