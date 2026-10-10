import type { ComponentConfig } from '@puckeditor/core'
import CtaCard from '../components/sections/kit/cta-card'
import CtaSplit from '../components/sections/kit/cta-split'
import GridHero from '../components/sections/kit/grid-hero'
import LogoCloud from '../components/sections/kit/logo-cloud'
import RotatingHero from '../components/sections/kit/rotating-hero'
import ShowcaseHero from '../components/sections/kit/showcase-hero'
import StatsCards from '../components/sections/kit/stats-cards'
import { kitSectionsContent as copy } from '../data/kit-sections'
import { defaultSectionSettings, type SectionSettingsValue } from '../section-settings'
import {
  type Frame,
  framed,
  type Image,
  imageField,
  inlineLinkField,
  type Link,
  noImage,
} from './framed'
import { inlineRichtext, inlineText } from './inline-fields'
import { beamField, f, sideField } from './kit-fields'
import { type KitTrustProps, kitTrustSections } from './kit-trust'

export type KitProps = KitTrustProps & {
  GridHero: Frame & { badge: string; heading: string; text: string; primary: Link; secondary: Link }
  RotatingHero: Frame & {
    before: string
    words: { word: string }[]
    after: string
    text: string
    primary: Link
    proof: string
    image: Image
    imageSide: 'left' | 'right'
  }
  ShowcaseHero: Frame & {
    eyebrow: string
    heading: string
    text: string
    primary: Link
    secondary: Link
    image: Image
    beam: boolean
  }
  LogoCloud: Frame & {
    heading: string
    columns: 3 | 4 | 6
    logos: { image: Image; name: string; href: string }[]
  }
  StatsCards: Frame & {
    heading: string
    stats: { value: number; prefix: string; suffix: string; label: string; detail: string }[]
  }
  CtaCard: Frame & { heading: string; text: string; primary: Link; secondary: Link; beam: boolean }
  CtaSplit: Frame & {
    eyebrow: string
    heading: string
    text: string
    primary: Link
    image: Image
    imageSide: 'left' | 'right'
  }
}

type KitConfig = Record<keyof KitProps | keyof KitTrustProps, ComponentConfig>

/** Edge to edge with no padding of its own: the grid hero draws its own space and floor. */
function fullBleed(): SectionSettingsValue {
  const settings = defaultSectionSettings({ padTop: 0, padBottom: 0 })
  return { ...settings, layout: { ...settings.layout, contentWidth: 'full' } }
}

const gridHeroDefaults: Omit<KitProps['GridHero'], keyof Frame> = {
  badge: copy.gridHero.badge,
  heading: copy.gridHero.heading,
  text: copy.gridHero.text,
  primary: { label: copy.gridHero.primary, href: '/collections/all' },
  secondary: { label: copy.gridHero.secondary, href: '/pages/about' },
}

/**
 * The starter kit: polished, theme-aware sections any shop can use (heroes, logos, stats,
 * calls to action), built on shared effects adapted from Magic UI (MIT) or our own layouts.
 * See THIRD_PARTY_NOTICES.md. Each one is `framed()`, so it has the shared section settings.
 */
export function kitSections(): KitConfig {
  return {
    ...kitTrustSections(),
    GridHero: framed<KitProps['GridHero']>(
      copy.labels.gridHero,
      {
        badge: inlineText(f.badge),
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        primary: inlineLinkField(f.primary),
        secondary: inlineLinkField(f.secondary),
      },
      gridHeroDefaults,
      (p) => <GridHero {...p} />,
      { defaultProps: { settings: fullBleed(), ...gridHeroDefaults } },
    ),

    RotatingHero: framed<KitProps['RotatingHero']>(
      copy.labels.rotatingHero,
      {
        before: inlineText(f.before),
        words: {
          type: 'array',
          label: f.words,
          max: 6,
          arrayFields: { word: { type: 'text', label: f.word } },
          defaultItemProps: { word: '' },
          getItemSummary: (item: { word?: string }) => item.word || f.word,
        },
        after: inlineText(f.after),
        text: inlineRichtext(f.text),
        primary: inlineLinkField(f.primary),
        proof: inlineText(f.proof),
        image: imageField(f.image),
        imageSide: sideField,
      },
      {
        before: copy.rotatingHero.before,
        words: copy.rotatingHero.words.map((word) => ({ word })),
        after: copy.rotatingHero.after,
        text: copy.rotatingHero.text,
        primary: { label: copy.rotatingHero.primary, href: '/collections/all' },
        proof: copy.rotatingHero.proof,
        image: noImage,
        imageSide: 'right',
      },
      (p) => <RotatingHero {...p} />,
    ),

    ShowcaseHero: framed<KitProps['ShowcaseHero']>(
      copy.labels.showcaseHero,
      {
        eyebrow: inlineText(f.eyebrow),
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        primary: inlineLinkField(f.primary),
        secondary: inlineLinkField(f.secondary),
        image: imageField(f.image),
        beam: beamField,
      },
      {
        eyebrow: copy.showcaseHero.eyebrow,
        heading: copy.showcaseHero.heading,
        text: copy.showcaseHero.text,
        primary: { label: copy.showcaseHero.primary, href: '/collections/all' },
        secondary: { label: copy.showcaseHero.secondary, href: '/pages/about' },
        image: noImage,
        beam: true,
      },
      (p) => <ShowcaseHero {...p} />,
    ),

    LogoCloud: framed<KitProps['LogoCloud']>(
      copy.labels.logoCloud,
      {
        heading: inlineText(f.heading),
        columns: {
          type: 'select',
          label: f.columns,
          options: [
            { label: '3', value: 3 },
            { label: '4', value: 4 },
            { label: '6', value: 6 },
          ],
        },
        logos: {
          type: 'array',
          label: f.logos,
          max: 12,
          arrayFields: {
            image: imageField(f.logo),
            name: { type: 'text', label: f.name },
            href: { type: 'text', label: f.link },
          },
          defaultItemProps: { image: noImage, name: '', href: '' },
          getItemSummary: (item: { name?: string }) => item.name || f.logo,
        },
      },
      {
        heading: copy.logoCloud.heading,
        columns: 6,
        logos: copy.logoCloud.logos.map((name) => ({ image: noImage, name, href: '' })),
      },
      (p) => <LogoCloud {...p} />,
    ),

    StatsCards: framed<KitProps['StatsCards']>(
      copy.labels.statsCards,
      {
        heading: inlineText(f.heading),
        stats: {
          type: 'array',
          label: f.stats,
          max: 4,
          arrayFields: {
            value: { type: 'number', label: f.value },
            prefix: inlineText(f.prefix),
            suffix: inlineText(f.suffix),
            label: inlineText(f.label),
            detail: inlineText(f.detail),
          },
          defaultItemProps: { value: 100, prefix: '', suffix: '+', label: '', detail: '' },
          getItemSummary: (item: { label?: unknown }) =>
            typeof item.label === 'string' && item.label ? item.label : f.label,
        },
      },
      {
        heading: copy.statsCards.heading,
        stats: copy.statsCards.stats.map((s) => ({ ...s })),
      },
      (p) => <StatsCards {...p} />,
    ),

    CtaCard: framed<KitProps['CtaCard']>(
      copy.labels.ctaCard,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        primary: inlineLinkField(f.primary),
        secondary: inlineLinkField(f.secondary),
        beam: beamField,
      },
      {
        heading: copy.ctaCard.heading,
        text: copy.ctaCard.text,
        primary: { label: copy.ctaCard.primary, href: '/collections/all' },
        secondary: { label: copy.ctaCard.secondary, href: '/pages/contact' },
        beam: true,
      },
      (p) => <CtaCard {...p} />,
    ),

    CtaSplit: framed<KitProps['CtaSplit']>(
      copy.labels.ctaSplit,
      {
        eyebrow: inlineText(f.eyebrow),
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        primary: inlineLinkField(f.primary),
        image: imageField(f.image),
        imageSide: sideField,
      },
      {
        eyebrow: copy.ctaSplit.eyebrow,
        heading: copy.ctaSplit.heading,
        text: copy.ctaSplit.text,
        primary: { label: copy.ctaSplit.primary, href: '/collections/all' },
        image: noImage,
        imageSide: 'left',
      },
      (p) => <CtaSplit {...p} />,
    ),
  }
}
