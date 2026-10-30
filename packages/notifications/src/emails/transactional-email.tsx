import type { TemplateData } from '../types'
import type { ParcelsBlockProps, TaxLine } from './components'
import {
  Body,
  CodeBlock,
  Eyebrow,
  GiftCardBlock,
  Heading,
  ItemsTable,
  LinkLine,
  ParcelsBlock,
  PrimaryButton,
  TotalsBlock,
} from './components'
import { EmailLayout } from './layout'

export type TransactionalEmailProps = {
  storeName: string
  storeAddress?: string | undefined
  previewText: string
  eyebrow: string
  heading: string
  intro: string
  /** The merchant's own note for a hand-sent message, shown under the intro. */
  note?: string | undefined
  outro: string
  lines: TemplateData['lines']
  totalLabel?: string | undefined
  shipping?: TaxLine | undefined
  taxBreakdown?: TaxLine[] | undefined
  /** "Ships in 2 parcels", already in words. */
  parcels?: ParcelsBlockProps | undefined
  giftCard?: TemplateData['giftCard']
  code?: string | undefined
  primaryAction?: { label: string; url: string } | undefined
  extraLinks?: { label: string; url: string }[] | undefined
  footerNote: string
}

/**
 * The one template every transactional message renders through. Copy stays
 * data-driven (built in templates/content.ts); this component only lays it
 * out. Optional blocks (gift card, code, items+totals) render only when the
 * caller passes that data, so one component covers every TemplateId.
 */
export function TransactionalEmail({
  storeName,
  storeAddress,
  previewText,
  eyebrow,
  heading,
  intro,
  note,
  outro,
  lines,
  totalLabel,
  shipping,
  taxBreakdown,
  parcels,
  giftCard,
  code,
  primaryAction,
  extraLinks,
  footerNote,
}: TransactionalEmailProps) {
  return (
    <EmailLayout
      previewText={previewText}
      storeName={storeName}
      storeAddress={storeAddress}
      footerNote={footerNote}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading>{heading}</Heading>
      {intro ? <Body>{intro}</Body> : null}
      {note
        ?.split(/\n+/)
        .filter(Boolean)
        .map((p) => (
          <Body key={p}>{p}</Body>
        ))}
      {code ? <CodeBlock code={code} /> : null}
      {giftCard ? (
        <GiftCardBlock
          code={giftCard.code}
          balanceLabel={giftCard.balanceLabel}
          message={giftCard.message}
        />
      ) : null}
      {lines.length > 0 ? <ItemsTable lines={lines} /> : null}
      {lines.length > 0 && totalLabel ? (
        <TotalsBlock totalLabel={totalLabel} shipping={shipping} taxBreakdown={taxBreakdown} />
      ) : null}
      {parcels ? <ParcelsBlock {...parcels} /> : null}
      {outro ? <Body>{outro}</Body> : null}
      {primaryAction ? (
        <PrimaryButton href={primaryAction.url}>{primaryAction.label}</PrimaryButton>
      ) : null}
      {(extraLinks ?? []).map((l) => (
        <LinkLine key={l.url} label={l.label} href={l.url} />
      ))}
    </EmailLayout>
  )
}
