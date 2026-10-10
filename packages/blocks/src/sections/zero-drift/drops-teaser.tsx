import DropsTeaser from '../../components/sections/zero-drift/drops-teaser'
import { dropsTeaserContent as copy } from '../../data/zero-drift/drops-teaser'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

type DropItem = {
  period: string
  title: string
  text: string
  status: 'coming' | 'preorder' | 'shipping'
  link: string
  linkLabel: string
}

export type DropsTeaserProps = Frame & {
  eyebrow: string
  heading: string
  roadmapLink: string
  roadmapLabel: string
  drops: DropItem[]
}

const defaults = {
  eyebrow: copy.eyebrow,
  heading: copy.heading,
  roadmapLink: copy.roadmapLink,
  roadmapLabel: copy.roadmapLabel,
  drops: copy.drops.map((d) => ({ ...d })) as DropItem[],
}

// The theme can also read its cards from Roadmap entries; here the cards are always written in the section.
export function dropsTeaserSection(_loaders: ZeroDriftLoaders) {
  return framed<DropsTeaserProps>(
    copy.label,
    {
      eyebrow: inlineText('Small line above the heading'),
      heading: inlineText('Heading'),
      roadmapLink: { type: 'text', label: 'Roadmap page link (blank hides the button)' },
      roadmapLabel: inlineText('Roadmap button label'),
      drops: {
        type: 'array',
        label: 'Drops',
        max: copy.maxDrops,
        getItemSummary: (d: { title?: string }) =>
          (typeof d.title === 'string' && d.title) || 'Drop',
        defaultItemProps: { ...copy.newDrop },
        arrayFields: {
          period: inlineText('When (month and year)'),
          title: inlineText('Name'),
          text: inlineRichtext('Text'),
          status: { type: 'select', label: 'Status', options: copy.statusOptions },
          link: { type: 'text', label: 'Link' },
          linkLabel: inlineText('Link label'),
        },
      },
    },
    defaults,
    (p) => (
      <DropsTeaser
        eyebrow={p.eyebrow}
        heading={p.heading}
        roadmapLink={p.roadmapLink}
        roadmapLabel={p.roadmapLabel}
        drops={p.drops ?? []}
      />
    ),
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 64, padBottom: 64 }),
      },
    },
  )
}
