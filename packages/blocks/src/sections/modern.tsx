import type { ComponentConfig } from '@puckeditor/core'
import BentoGrid from '../components/sections/bento-grid'
import CtaBanner from '../components/sections/cta-banner'
import FaqAccordion from '../components/sections/faq-accordion'
import Gallery from '../components/sections/gallery'
import LogoMarquee from '../components/sections/logo-marquee'
import SplitHero from '../components/sections/split-hero'
import SpotlightHero from '../components/sections/spotlight-hero'
import StatsCounter from '../components/sections/stats-counter'
import TestimonialMarquee from '../components/sections/testimonial-marquee'
import VideoHero from '../components/sections/video-hero'
import { modernSectionsContent as copy } from '../data/modern-sections'
import { type Frame, framed, type Image, imageField, type Link, linkField, noImage } from './framed'

const heading = { type: 'text', label: 'Heading' } as const
const noLink: Link = { label: '', href: '' }

export type ModernProps = {
  SpotlightHero: Frame & { heading: string; text: string; primary: Link; secondary: Link }
  SplitHero: Frame & {
    eyebrow: string
    heading: string
    text: string
    button: Link
    image: Image
    imageFirst: boolean
  }
  VideoHero: Frame & {
    videoUrl: string
    poster: Image
    overlayOpacity: number
    heading: string
    text: string
    button: Link
  }
  BentoGrid: Frame & {
    heading: string
    tiles: { title: string; text: string; image: Image; size: 'small' | 'wide' | 'tall' }[]
  }
  LogoMarquee: Frame & {
    heading: string
    logos: { image: Image; alt: string; href: string }[]
    speedSeconds: number
  }
  TestimonialMarquee: Frame & {
    heading: string
    items: { quote: string; author: string; role: string }[]
  }
  StatsCounter: Frame & {
    heading: string
    stats: { value: number; prefix: string; suffix: string; label: string }[]
  }
  FaqAccordion: Frame & {
    heading: string
    intro: string
    items: { question: string; answer: string }[]
    multiOpen: boolean
  }
  CtaBanner: Frame & { heading: string; text: string; button: Link; secondaryButton: Link }
  Gallery: Frame & {
    heading: string
    layout: 'grid' | 'masonry' | 'carousel'
    images: { image: Image; caption: string; link: Link }[]
  }
}

type ModernConfig = Record<keyof ModernProps, ComponentConfig>

/**
 * "Modern" section batch: Aceternity/Magic UI/shadcnblocks-pattern sections (spotlight hero,
 * marquees, bento grid, FAQ accordion, glow CTA, gallery — see docs/licences and
 * THIRD_PARTY_NOTICES.md for what's adapted vs. pattern-after). Built the same way as
 * `./library.tsx`'s sections: `framed()` wraps each in the shared `SectionFrame` settings.
 */
export function modernSections(): ModernConfig {
  return {
    SpotlightHero: framed<ModernProps['SpotlightHero']>(
      'Spotlight hero',
      {
        heading,
        text: { type: 'textarea', label: 'Text' },
        primary: linkField('Primary button'),
        secondary: linkField('Secondary button'),
      },
      {
        heading: copy.spotlightHero.heading,
        text: copy.spotlightHero.text,
        primary: { label: copy.spotlightHero.primary, href: '/collections/all' },
        secondary: { label: copy.spotlightHero.secondary, href: '/pages/about' },
      },
      (p) => (
        <SpotlightHero
          heading={p.heading}
          text={p.text}
          primary={p.primary}
          secondary={p.secondary}
        />
      ),
    ),

    SplitHero: framed<ModernProps['SplitHero']>(
      'Split hero',
      {
        eyebrow: { type: 'text', label: 'Eyebrow' },
        heading,
        text: { type: 'textarea', label: 'Text' },
        button: linkField(),
        image: imageField(),
        imageFirst: {
          type: 'radio',
          label: 'Image position',
          options: [
            { label: 'Right', value: false },
            { label: 'Left', value: true },
          ],
        },
      },
      {
        eyebrow: copy.splitHero.eyebrow,
        heading: copy.splitHero.heading,
        text: copy.splitHero.text,
        button: { label: copy.splitHero.button, href: '/collections/all' },
        image: noImage,
        imageFirst: false,
      },
      (p) => <SplitHero {...p} />,
    ),

    VideoHero: framed<ModernProps['VideoHero']>(
      'Video hero',
      {
        videoUrl: { type: 'text', label: 'Video URL (mp4)' },
        poster: imageField('Poster image'),
        overlayOpacity: { type: 'number', label: 'Overlay opacity (%)', min: 0, max: 90 },
        heading,
        text: { type: 'textarea', label: 'Text' },
        button: linkField(),
      },
      {
        videoUrl: '',
        poster: noImage,
        overlayOpacity: 40,
        heading: copy.videoHero.heading,
        text: copy.videoHero.text,
        button: { label: copy.videoHero.button, href: '/collections/all' },
      },
      (p) => (
        <VideoHero
          videoUrl={p.videoUrl}
          poster={p.poster}
          overlayOpacity={p.overlayOpacity}
          heading={p.heading}
          text={p.text}
          button={p.button}
        />
      ),
    ),

    BentoGrid: framed<ModernProps['BentoGrid']>(
      'Bento grid',
      {
        heading,
        tiles: {
          type: 'array',
          label: 'Tiles',
          getItemSummary: (t: { title?: string }) => t.title || 'Tile',
          arrayFields: {
            title: { type: 'text', label: 'Title' },
            text: { type: 'textarea', label: 'Text' },
            image: imageField(),
            size: {
              type: 'select',
              label: 'Size',
              options: [
                { label: 'Small', value: 'small' },
                { label: 'Wide', value: 'wide' },
                { label: 'Tall', value: 'tall' },
              ],
            },
          },
        },
      },
      {
        heading: copy.bentoGrid.heading,
        tiles: copy.bentoGrid.tiles.map((t) => ({ ...t, image: noImage })),
      },
      (p) => <BentoGrid heading={p.heading} tiles={p.tiles} />,
    ),

    LogoMarquee: framed<ModernProps['LogoMarquee']>(
      'Logo marquee',
      {
        heading,
        logos: {
          type: 'array',
          label: 'Logos',
          getItemSummary: (l: { alt?: string }) => l.alt || 'Logo',
          arrayFields: {
            image: imageField('Logo'),
            alt: { type: 'text', label: 'Alt / fallback text' },
            href: { type: 'text', label: 'Link' },
          },
        },
        speedSeconds: { type: 'number', label: 'Speed (seconds per loop)', min: 5, max: 120 },
      },
      {
        heading: copy.logoMarquee.heading,
        logos: [
          { image: noImage, alt: 'Brand one', href: '' },
          { image: noImage, alt: 'Brand two', href: '' },
          { image: noImage, alt: 'Brand three', href: '' },
          { image: noImage, alt: 'Brand four', href: '' },
        ],
        speedSeconds: 30,
      },
      (p) => <LogoMarquee heading={p.heading} logos={p.logos} speedSeconds={p.speedSeconds} />,
    ),

    TestimonialMarquee: framed<ModernProps['TestimonialMarquee']>(
      'Testimonial marquee',
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
        heading: copy.testimonialMarquee.heading,
        items: copy.testimonialMarquee.items.map((t) => ({ ...t })),
      },
      (p) => <TestimonialMarquee heading={p.heading} items={p.items} />,
    ),

    StatsCounter: framed<ModernProps['StatsCounter']>(
      'Stats counter',
      {
        heading,
        stats: {
          type: 'array',
          label: 'Stats',
          getItemSummary: (s: { label?: string }) => s.label || 'Stat',
          arrayFields: {
            value: { type: 'number', label: 'Value' },
            prefix: { type: 'text', label: 'Prefix' },
            suffix: { type: 'text', label: 'Suffix' },
            label: { type: 'text', label: 'Label' },
          },
        },
      },
      { heading: copy.statsCounter.heading, stats: copy.statsCounter.stats.map((s) => ({ ...s })) },
      (p) => <StatsCounter heading={p.heading} stats={p.stats} />,
    ),

    FaqAccordion: framed<ModernProps['FaqAccordion']>(
      'FAQ accordion',
      {
        heading,
        intro: { type: 'textarea', label: 'Side intro (desktop)' },
        items: {
          type: 'array',
          label: 'Questions',
          getItemSummary: (q: { question?: string }) => q.question || 'Question',
          arrayFields: {
            question: { type: 'text', label: 'Question' },
            answer: { type: 'textarea', label: 'Answer' },
          },
        },
        multiOpen: {
          type: 'radio',
          label: 'Multiple open at once',
          options: [
            { label: 'Yes', value: true },
            { label: 'No, single open', value: false },
          ],
        },
      },
      {
        heading: copy.faqAccordion.heading,
        intro: copy.faqAccordion.intro,
        items: copy.faqAccordion.items.map((q) => ({ ...q })),
        multiOpen: false,
      },
      (p) => (
        <FaqAccordion heading={p.heading} intro={p.intro} items={p.items} multiOpen={p.multiOpen} />
      ),
    ),

    CtaBanner: framed<ModernProps['CtaBanner']>(
      'CTA banner with glow',
      {
        heading,
        text: { type: 'textarea', label: 'Text' },
        button: linkField('Primary button'),
        secondaryButton: linkField('Secondary button'),
      },
      {
        heading: copy.ctaBanner.heading,
        text: copy.ctaBanner.text,
        button: { label: copy.ctaBanner.button, href: '/collections/all' },
        secondaryButton: noLink,
      },
      (p) => (
        <CtaBanner
          heading={p.heading}
          text={p.text}
          button={p.button}
          secondaryButton={p.secondaryButton}
        />
      ),
    ),

    Gallery: framed<ModernProps['Gallery']>(
      'Image gallery',
      {
        heading,
        layout: {
          type: 'select',
          label: 'Layout',
          options: [
            { label: 'Grid', value: 'grid' },
            { label: 'Masonry', value: 'masonry' },
            { label: 'Carousel on mobile', value: 'carousel' },
          ],
        },
        images: {
          type: 'array',
          label: 'Images',
          getItemSummary: (i: { caption?: string }) => i.caption || 'Image',
          arrayFields: {
            image: imageField(),
            caption: { type: 'text', label: 'Caption' },
            link: linkField('Link'),
          },
        },
      },
      {
        heading: copy.gallery.heading,
        layout: 'grid',
        images: copy.gallery.images.map((i) => ({
          image: noImage,
          caption: i.caption,
          link: noLink,
        })),
      },
      (p) => <Gallery heading={p.heading} layout={p.layout} images={p.images} />,
    ),
  }
}
