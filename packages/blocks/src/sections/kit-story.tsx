import type { ComponentConfig } from '@puckeditor/core'
import Lookbook from '../components/sections/kit/lookbook'
import NewsletterBand from '../components/sections/kit/newsletter-band'
import TeamGrid from '../components/sections/kit/team-grid'
import Timeline from '../components/sections/kit/timeline'
import TrustBadges from '../components/sections/kit/trust-badges'
import { kitSectionsContent as copy } from '../data/kit-sections'
import { type Frame, framed, type Image, imageField, noImage } from './framed'
import { inlineRichtext, inlineText, inlineTextarea } from './inline-fields'
import { f, ICONS, summary } from './kit-fields'

export type KitStoryProps = {
  Lookbook: Frame & {
    heading: string
    text: string
    photos: { image: Image; caption: string; href: string }[]
  }
  NewsletterBand: Frame & { heading: string; text: string; button: string; reassurance: string }
  Timeline: Frame & {
    heading: string
    text: string
    milestones: { date: string; title: string; text: string }[]
  }
  TeamGrid: Frame & {
    heading: string
    text: string
    people: { photo: Image; name: string; role: string; bio: string }[]
  }
  TrustBadges: Frame & { badges: { icon: string; title: string; text: string }[] }
}

/**
 * Starter kit, batch 3: the sections that tell the shop's story (lookbook, email signup band,
 * timeline, team, trust badges). Same rules as `./kit.tsx`.
 */
export function kitStorySections(): Record<keyof KitStoryProps, ComponentConfig> {
  return {
    Lookbook: framed<KitStoryProps['Lookbook']>(
      copy.labels.lookbook,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        photos: {
          type: 'array',
          label: f.photos,
          max: 12,
          arrayFields: {
            image: imageField(f.photo),
            caption: inlineText(f.caption),
            href: { type: 'text', label: f.link },
          },
          defaultItemProps: { image: noImage, caption: '', href: '' },
          getItemSummary: (item: { caption?: unknown }) => summary(item.caption, f.photo),
        },
      },
      {
        heading: copy.lookbook.heading,
        text: copy.lookbook.text,
        photos: copy.lookbook.photos.map((caption) => ({ image: noImage, caption, href: '' })),
      },
      (p) => <Lookbook {...p} />,
    ),

    NewsletterBand: framed<KitStoryProps['NewsletterBand']>(
      copy.labels.newsletterBand,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        button: inlineText(f.button),
        reassurance: inlineText(f.reassurance),
      },
      {
        heading: copy.newsletterBand.heading,
        text: copy.newsletterBand.text,
        button: copy.newsletterBand.button,
        reassurance: copy.newsletterBand.reassurance,
      },
      // The storefront's subscribe action arrives as section metadata, as for Email signup.
      (p, meta) => <NewsletterBand {...p} action={meta.newsletterAction} />,
    ),

    Timeline: framed<KitStoryProps['Timeline']>(
      copy.labels.timeline,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        milestones: {
          type: 'array',
          label: f.milestones,
          max: 12,
          arrayFields: {
            date: inlineText(f.date),
            title: inlineText(f.title),
            text: inlineTextarea(f.text),
          },
          defaultItemProps: { date: '', title: '', text: '' },
          getItemSummary: (item: { title?: unknown }) => summary(item.title, f.milestone),
        },
      },
      {
        heading: copy.timeline.heading,
        text: copy.timeline.text,
        milestones: copy.timeline.milestones.map((m) => ({ ...m })),
      },
      (p) => <Timeline {...p} />,
    ),

    TeamGrid: framed<KitStoryProps['TeamGrid']>(
      copy.labels.teamGrid,
      {
        heading: inlineText(f.heading),
        text: inlineRichtext(f.text),
        people: {
          type: 'array',
          label: f.people,
          max: 12,
          arrayFields: {
            photo: imageField(f.photo),
            name: inlineText(f.name),
            role: inlineText(f.role),
            bio: inlineTextarea(f.bio),
          },
          defaultItemProps: { photo: noImage, name: '', role: '', bio: '' },
          getItemSummary: (item: { name?: unknown }) => summary(item.name, f.person),
        },
      },
      {
        heading: copy.teamGrid.heading,
        text: copy.teamGrid.text,
        people: copy.teamGrid.people.map((person) => ({ photo: noImage, ...person })),
      },
      (p) => <TeamGrid {...p} />,
    ),

    TrustBadges: framed<KitStoryProps['TrustBadges']>(
      copy.labels.trustBadges,
      {
        badges: {
          type: 'array',
          label: f.badges,
          max: 4,
          arrayFields: {
            icon: { type: 'select', label: f.icon, options: ICONS },
            title: inlineText(f.title),
            text: inlineText(f.text),
          },
          defaultItemProps: { icon: 'check', title: '', text: '' },
          getItemSummary: (item: { title?: unknown }) => summary(item.title, f.badge2),
        },
      },
      { badges: copy.trustBadges.badges.map((badge) => ({ ...badge })) },
      (p) => <TrustBadges {...p} />,
    ),
  }
}
