import { Section } from '@react-email/components'
import type { EmailBrandInfo, TemplateData } from '../types'
import type { HeroShot, ParcelsBlockProps, TaxLine } from './components'
import {
  Body,
  CodeBox,
  Hero,
  Intro,
  ItemsPanel,
  LinkLine,
  MetaPills,
  ParcelsBlock,
  PrimaryButton,
  Steps,
} from './components'
import { EmailLayout, type LayoutLabels } from './layout'
import { brandColours } from './theme'

export type TransactionalEmailProps = {
  storeName: string
  storeAddress?: string | undefined
  brand?: EmailBrandInfo | undefined
  previewText: string
  eyebrow: string
  /** The big uppercase line in the coloured hero ("Order confirmed"). */
  heroTitle: string
  heroLine?: string | undefined
  shot?: HeroShot | undefined
  /** A four-step tracker under the hero (delivery or return progress). */
  steps?: { labels: string[]; current: number } | undefined
  heading: string
  intro: string
  /** The merchant's own note for a hand-sent message, shown under the intro. */
  note?: string | undefined
  outro: string
  lines: TemplateData['lines']
  itemsTitle: string
  totalHeading: string
  qty: (n: number) => string
  totalLabel?: string | undefined
  shipping?: TaxLine | undefined
  taxBreakdown?: TaxLine[] | undefined
  /** "Ships in 2 parcels", already in words. */
  parcels?: ParcelsBlockProps | undefined
  giftCard?: { label: string; code: string; lines: (string | undefined)[] } | undefined
  primaryAction?: { label: string; url: string } | undefined
  meta?: string[] | undefined
  extraLinks?: { label: string; url: string }[] | undefined
  internal?: boolean | undefined
  labels: LayoutLabels
  footerNote: string
}

/**
 * The one template every transactional message renders through, in the store's own colours
 * (owner, 3 Nov 2026: the "Brand" look). Copy stays data-driven (templates/content.ts); this
 * component only lays it out, and optional blocks render only when the caller passes that data.
 */
export function TransactionalEmail(p: TransactionalEmailProps) {
  const colours = brandColours(p.brand)
  const paragraphs = [p.intro, ...(p.note?.split(/\n+/).filter(Boolean) ?? [])].filter(Boolean)
  return (
    <EmailLayout
      previewText={p.previewText}
      storeName={p.storeName}
      storeAddress={p.storeAddress}
      brand={p.brand}
      footerNote={p.footerNote}
      internal={p.internal}
      labels={p.labels}
    >
      <Hero
        colours={colours}
        eyebrow={p.eyebrow}
        title={p.heroTitle}
        line={p.heroLine}
        shot={p.shot}
      />
      {p.steps ? (
        <Steps colours={colours} labels={p.steps.labels} current={p.steps.current} />
      ) : null}
      <Intro heading={p.heading}>
        {paragraphs.map((t) => (
          <Body key={t}>{t}</Body>
        ))}
      </Intro>
      {p.primaryAction ? (
        <PrimaryButton href={p.primaryAction.url} colours={colours}>
          {p.primaryAction.label}
        </PrimaryButton>
      ) : null}
      <MetaPills items={p.meta ?? []} />
      {p.giftCard ? (
        <CodeBox
          colours={colours}
          label={p.giftCard.label}
          code={p.giftCard.code}
          lines={p.giftCard.lines}
        />
      ) : null}
      <ItemsPanel
        title={p.itemsTitle}
        lines={p.lines}
        colours={colours}
        totalHeading={p.totalHeading}
        totalLabel={p.totalLabel}
        shipping={p.shipping}
        taxBreakdown={p.taxBreakdown}
        qty={p.qty}
      />
      {p.parcels ? <ParcelsBlock {...p.parcels} /> : null}
      {p.outro || (p.extraLinks ?? []).length > 0 ? (
        <Section className="k-pad" style={{ padding: '24px 40px 0', textAlign: 'center' }}>
          {p.outro ? <Body>{p.outro}</Body> : null}
          {(p.extraLinks ?? []).map((l) => (
            <LinkLine key={l.url} label={l.label} href={l.url} />
          ))}
        </Section>
      ) : null}
    </EmailLayout>
  )
}
