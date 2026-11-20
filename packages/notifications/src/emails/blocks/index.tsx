import { Link, Section, Text } from '@react-email/components'
import type { ComponentProps, ReactNode } from 'react'
import { Body, DividerLabel, LinkLine, PrimaryButton } from '../components'
import { theme } from '../theme'
import { ItemsPanel } from '../items-panel'
import {
  type ColumnsBlock,
  Columns,
  type FactsBlock,
  Facts,
  type NoticeBlock,
  Notice,
  type QuoteBlock,
  Quote,
  type StatsBlock,
  Stats,
  type StatusBlock,
  Status,
} from './boxes'
import { Code, type CodeBlock, Coupon, type CouponBlock } from './codes'
import {
  Attachment,
  type AttachmentBlock,
  Product,
  type ProductBlock,
  Products,
  type ProductsBlock,
} from './media'
import { Parcels, type ParcelsBlock } from './parcels'
import { Ticket, type TicketBlock } from './ticket'
import { BLOCK_PAD } from './tokens'

export type { Tone } from './tokens'
export type {
  AttachmentBlock,
  CodeBlock,
  ColumnsBlock,
  CouponBlock,
  FactsBlock,
  NoticeBlock,
  ParcelsBlock,
  ProductBlock,
  ProductsBlock,
  QuoteBlock,
  StatsBlock,
  StatusBlock,
  TicketBlock,
}

/** The order lines and totals (`ItemsPanel`), under a "YOUR ORDER" divider. */
export type ItemsBlock = { kind: 'items' } & Omit<ComponentProps<typeof ItemsPanel>, 'colours'>
/** The ink button with an arrow, centred; `secondary` a quiet link under it ("Cancel it"). */
export type ButtonBlock = {
  kind: 'button'
  label: string
  url: string
  secondary?: { label: string; url: string } | undefined
}
/** A caps label between two hairlines. */
export type DividerBlock = { kind: 'divider'; label: string }
/**
 * A plain centred paragraph (the merchant's note, a line of help); `muted` the small italic
 * line at the end of an email ("Did not ask for this? Ignore this email.").
 */
export type TextBlock = { kind: 'text'; text: string; muted?: boolean | undefined }
/** Extra links under the message (an app's "Download invoice"), one per line. */
export type LinksBlock = { kind: 'links'; items: { label: string; url: string }[] }

/**
 * Every block an email can be built from (Figma "Emails" batches). A template lists the blocks
 * it needs in order, filled with its words; `BlockList` draws them with the same spacing in
 * every email. Adding an email is choosing blocks, not drawing a new layout.
 */
export type EmailBlock =
  | TicketBlock
  | NoticeBlock
  | StatusBlock
  | FactsBlock
  | StatsBlock
  | ColumnsBlock
  | QuoteBlock
  | CodeBlock
  | CouponBlock
  | AttachmentBlock
  | ProductBlock
  | ProductsBlock
  | ParcelsBlock
  | ItemsBlock
  | ButtonBlock
  | DividerBlock
  | TextBlock
  | LinksBlock

/** The card's side padding around a block; phones narrow it (`k-pad`). */
function Pad({ children }: { children: ReactNode }) {
  return (
    <Section className="k-pad" style={BLOCK_PAD}>
      {children}
    </Section>
  )
}

function Block({ block: b, accent }: { block: EmailBlock; accent: string }) {
  switch (b.kind) {
    case 'ticket':
      return (
        <Pad>
          <Ticket block={b} accent={accent} />
        </Pad>
      )
    case 'notice':
      return (
        <Pad>
          <Notice block={b} accent={accent} />
        </Pad>
      )
    case 'status':
      return (
        <Pad>
          <Status block={b} accent={accent} />
        </Pad>
      )
    case 'facts':
      return (
        <Pad>
          <Facts block={b} />
        </Pad>
      )
    case 'stats':
      return (
        <Pad>
          <Stats block={b} accent={accent} />
        </Pad>
      )
    case 'columns':
      return (
        <Pad>
          <Columns block={b} accent={accent} />
        </Pad>
      )
    case 'quote':
      return (
        <Pad>
          <Quote block={b} accent={accent} />
        </Pad>
      )
    case 'code':
      return (
        <Pad>
          <Code block={b} accent={accent} />
        </Pad>
      )
    case 'coupon':
      return (
        <Pad>
          <Coupon block={b} accent={accent} />
        </Pad>
      )
    case 'attachment':
      return (
        <Pad>
          <Attachment block={b} accent={accent} />
        </Pad>
      )
    case 'products':
      return (
        <Pad>
          <Products block={b} />
        </Pad>
      )
    case 'product':
      return (
        <Pad>
          <Product block={b} accent={accent} />
        </Pad>
      )
    case 'parcels':
      return (
        <Pad>
          <Parcels block={b} accent={accent} />
        </Pad>
      )
    case 'items': {
      const { kind: _kind, ...props } = b
      return <ItemsPanel {...props} />
    }
    case 'button':
      return (
        <>
          <PrimaryButton href={b.url}>{b.label}</PrimaryButton>
          {b.secondary ? (
            <Section style={{ padding: '12px 24px 0', textAlign: 'center' }}>
              <Link href={b.secondary.url} style={{ fontSize: '14px', color: theme.body, textDecoration: 'underline' }}>
                {b.secondary.label}
              </Link>
            </Section>
          ) : null}
        </>
      )
    case 'links':
      return (
        <Pad>
          {b.items.map((l) => (
            <LinkLine key={l.url} label={l.label} href={l.url} />
          ))}
        </Pad>
      )
    case 'divider':
      return <DividerLabel>{b.label}</DividerLabel>
    case 'text':
      return (
        <Pad>
          {b.muted ? (
            <Text
              style={{ margin: 0, fontSize: '13.5px', lineHeight: '20px', fontStyle: 'italic', color: theme.muted, textAlign: 'center' }}
            >
              {b.text}
            </Text>
          ) : (
            <Body>{b.text}</Body>
          )}
        </Pad>
      )
  }
}

/** Draws a template's blocks in order. */
export function BlockList({ blocks, accent }: { blocks: EmailBlock[]; accent: string }) {
  return (
    <>
      {blocks.map((b, i) => (
        // Blocks have no ids; their order is fixed for one render.
        // biome-ignore lint/suspicious/noArrayIndexKey: static list, never reordered
        <Block key={`${b.kind}-${i}`} block={b} accent={accent} />
      ))}
    </>
  )
}
