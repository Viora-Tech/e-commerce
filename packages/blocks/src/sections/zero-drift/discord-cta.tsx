import type { ComponentConfig } from '@puckeditor/core'
import type { IconName } from '../../components/icon'
import DiscordCta from '../../components/sections/zero-drift/discord-cta'
import { discordCtaContent as copy } from '../../data/zero-drift/discord-cta'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

type Perk = { icon: IconName; title: string; text: string }

export type DiscordCtaProps = Frame & {
  eyebrow: string
  heading: string
  text: string
  perks: Perk[]
  buttonLabel: string
  buttonUrl: string
  footnote: string
  ground: 'aurora' | 'ink'
  backgroundImage: Image
  overlay: number
}

const defaults: Omit<DiscordCtaProps, keyof Frame> = {
  eyebrow: copy.eyebrow,
  heading: copy.heading,
  text: copy.text,
  perks: copy.perks.map((p) => ({ ...p })) as Perk[],
  buttonLabel: copy.buttonLabel,
  buttonUrl: copy.buttonUrl,
  footnote: copy.footnote,
  ground: 'aurora',
  backgroundImage: noImage,
  overlay: 50,
}

// Port of sections/discord-cta.liquid. No loaders: the section carries no store data.
export function discordCtaSection(_loaders: ZeroDriftLoaders): ComponentConfig {
  return framed<DiscordCtaProps>(
    copy.label,
    {
      eyebrow: inlineText(copy.fields.eyebrow),
      heading: inlineText(copy.fields.heading),
      text: inlineRichtext(copy.fields.text),
      perks: {
        type: 'array',
        label: copy.fields.perks,
        max: 6,
        getItemSummary: (p: Perk) => p.title || copy.perkSummaryFallback,
        arrayFields: {
          icon: { type: 'select', label: copy.fields.perkIcon, options: copy.iconOptions },
          title: inlineText(copy.fields.perkTitle),
          text: inlineText(copy.fields.perkText),
        },
      },
      buttonLabel: inlineText(copy.fields.buttonLabel),
      buttonUrl: { type: 'text', label: copy.fields.buttonUrl },
      footnote: inlineText(copy.fields.footnote),
      ground: { type: 'radio', label: copy.fields.ground, options: copy.groundOptions },
      backgroundImage: imageField(copy.fields.backgroundImage),
      overlay: { type: 'number', label: copy.fields.overlay, min: 0, max: 90 },
    },
    defaults,
    (p) => (
      <DiscordCta
        eyebrow={p.eyebrow}
        heading={p.heading}
        text={p.text}
        perks={p.perks}
        buttonLabel={p.buttonLabel}
        buttonUrl={p.buttonUrl}
        footnote={p.footnote}
        ground={p.ground}
        backgroundImage={p.backgroundImage}
        overlay={p.overlay}
      />
    ),
    {
      defaultProps: { settings: defaultSectionSettings({ padTop: 0, padBottom: 0 }), ...defaults },
    },
  )
}
