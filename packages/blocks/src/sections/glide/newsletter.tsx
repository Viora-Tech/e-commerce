import type { ComponentConfig } from '@puckeditor/core'
import type { IconName } from '../../components/icon'
import Newsletter from '../../components/sections/newsletter'
import { newsletterContent as copy } from '../../data/glide/newsletter'
import { sectionsContent } from '../../data/sections'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed } from '../framed'
import { inlineRichtext, inlineText } from '../inline-fields'

type Interest = { label: string; tag: string }
type Reason = { icon: IconName; text: string }

/** `heading`, `text` and `button` are the original Email signup's props, so old saves keep rendering. */
export type NewsletterProps = Frame & {
  eyebrow: string
  heading: string
  text: string
  button: string
  reassurance: string
  interests: Interest[]
  reasons: Reason[]
}

const defaults: Omit<NewsletterProps, keyof Frame> = {
  eyebrow: copy.eyebrow,
  heading: copy.heading,
  text: copy.text,
  button: sectionsContent.newsletter.button,
  reassurance: copy.reassurance,
  interests: copy.interests.map((i) => ({ ...i })),
  reasons: copy.reasons.map((r) => ({ ...r })) as Reason[],
}

// Port of sections/newsletter.liquid (+ Aceternity Meteors in the card). The section key is
// still `Newsletter` ("Email signup"); the storefront's subscribe action arrives as metadata.
export function newsletterSection(): ComponentConfig {
  return framed<NewsletterProps>(
    sectionsContent.newsletter.sectionLabel,
    {
      eyebrow: inlineText(copy.fields.eyebrow),
      heading: inlineText(copy.fields.heading),
      text: inlineRichtext(copy.fields.text),
      reasons: {
        type: 'array',
        label: copy.fields.reasons,
        max: 4,
        getItemSummary: (r: Reason) =>
          typeof r.text === 'string' && r.text ? r.text : copy.reasonFallback,
        arrayFields: {
          icon: { type: 'select', label: copy.fields.reasonIcon, options: copy.iconOptions },
          text: inlineText(copy.fields.reasonText),
        },
      },
      interests: {
        type: 'array',
        label: copy.fields.interests,
        max: 4,
        getItemSummary: (i: Interest) =>
          typeof i.label === 'string' && i.label ? i.label : copy.interestFallback,
        arrayFields: {
          label: inlineText(copy.fields.interestLabel),
          tag: { type: 'text', label: copy.fields.interestTag },
        },
      },
      button: inlineText(copy.fields.button),
      reassurance: inlineText(copy.fields.reassurance),
    },
    defaults,
    (p, meta) => (
      <Newsletter
        eyebrow={p.eyebrow}
        heading={p.heading}
        text={p.text}
        button={p.button}
        reassurance={p.reassurance}
        interests={p.interests}
        reasons={p.reasons}
        action={meta.newsletterAction}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-3', padTop: 32, padBottom: 32 }),
        ...defaults,
      },
    },
  )
}
