import { Button, Column, Link, Row, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { theme } from './theme'

type Colours = { bg: string; fg: string }

export type { TaxLine } from './items-panel'

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace"

/** Four steps with the done ones filled in brand colour, e.g. Confirmed → Delivered. */
export function Steps({
  colours,
  labels,
  current,
}: {
  colours: Colours
  labels: string[]
  current: number
}) {
  return (
    <Section style={{ padding: '28px 24px 0' }}>
      <Row>
        {labels.map((label, i) => {
          const done = i <= current
          return (
            <Column
              key={label}
              style={{ width: `${100 / labels.length}%`, padding: '0 3px', verticalAlign: 'top' }}
            >
              <div
                style={{
                  height: '4px',
                  borderRadius: '4px',
                  backgroundColor: done ? colours.bg : theme.border,
                  fontSize: '1px',
                  lineHeight: '4px',
                }}
              >
                &nbsp;
              </div>
              <Text
                style={{
                  margin: '10px 0 0',
                  fontSize: '12px',
                  lineHeight: '16px',
                  fontWeight: i === current ? 800 : 600,
                  color: i === current ? colours.bg : done ? theme.ink : theme.faint,
                }}
              >
                {label}
              </Text>
            </Column>
          )
        })}
      </Row>
    </Section>
  )
}

/**
 * The top of every email under the header (Figma batches): a purple caps kicker ("Order #42 ·
 * Confirmed"), one large Times heading, then an italic line saying what happens next.
 */
export function Intro({
  eyebrow,
  heading,
  lead,
  accent = theme.accent,
  children,
}: {
  eyebrow?: string | undefined
  heading: string
  /** The italic line under the heading. */
  lead?: string | undefined
  accent?: string | undefined
  children?: ReactNode
}) {
  return (
    <Section className="k-pad" style={{ padding: '32px 48px 0', textAlign: 'center' }}>
      {eyebrow ? (
        <Text
          style={{
            margin: '0 0 12px',
            fontSize: '11px',
            lineHeight: '16px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        className="k-title"
        style={{
          margin: '0 0 10px',
          fontSize: heading.length > 34 ? '34px' : '40px',
          lineHeight: heading.length > 34 ? '40px' : '46px',
          fontWeight: 400,
          color: theme.ink,
        }}
      >
        {heading}
      </Text>
      {lead ? (
        <Text
          style={{
            margin: '0 0 6px',
            fontSize: '17px',
            lineHeight: '24px',
            fontStyle: 'italic',
            color: theme.body,
          }}
        >
          {lead}
        </Text>
      ) : null}
      {children}
    </Section>
  )
}

export function Body({
  children,
  align = 'center',
}: {
  children: ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <Text
      style={{
        fontSize: '15px',
        lineHeight: '23px',
        color: theme.body,
        margin: '10px 0 0',
        textAlign: align,
        whiteSpace: 'pre-line',
        // Long links and addresses wrap instead of widening the email past the screen.
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </Text>
  )
}

/** The one button style every email uses: ink with an arrow, always centred (owner rule). */
export function PrimaryButton({
  href,
  children,
}: {
  href: string
  children: string
  /** Kept for callers that still pass the store colours; buttons are ink everywhere now. */
  colours?: Colours | undefined
}) {
  return (
    <Section style={{ padding: '28px 24px 0', textAlign: 'center' }}>
      <Button
        href={href}
        style={{
          backgroundColor: theme.button,
          color: theme.onButton,
          fontSize: '16px',
          padding: '13px 28px',
          borderRadius: '4px',
          textDecoration: 'none',
          display: 'inline-block',
          textAlign: 'center',
        }}
      >
        {children}&nbsp;&nbsp;→
      </Button>
    </Section>
  )
}

/** A caps label between two hairlines: "YOUR ORDER". */
export function DividerLabel({ children }: { children: string }) {
  const rule = (
    <td style={{ width: '50%', verticalAlign: 'middle' }}>
      <div style={{ borderTop: `1px solid ${theme.border}`, fontSize: '1px', lineHeight: '1px' }}>
        &nbsp;
      </div>
    </td>
  )
  return (
    <Section className="k-pad" style={{ padding: '36px 48px 0' }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            {rule}
            <td
              style={{
                padding: '0 14px',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: theme.ink,
                fontFamily: theme.fontFamily,
              }}
            >
              {children}
            </td>
            {rule}
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

export type ParcelsBlockProps = {
  title: string
  note: string
  parcels: { heading: string; items: string[]; when: string | null }[]
}

/** "Ships in 2 parcels": each parcel's origin, items and expected dates. */
export function ParcelsBlock({ title, note, parcels }: ParcelsBlockProps) {
  return (
    <Section style={{ padding: '20px 24px 0' }}>
      <Section
        style={{
          border: `1.5px solid ${theme.border}`,
          borderRadius: '18px',
          padding: '20px 22px',
        }}
      >
        <Text style={{ fontSize: '15px', fontWeight: 700, color: theme.ink, margin: '0 0 4px' }}>
          {title}
        </Text>
        <Text
          style={{ fontSize: '12.5px', lineHeight: '19px', color: theme.muted, margin: '0 0 8px' }}
        >
          {note}
        </Text>
        {parcels.map((p) => (
          <Section
            key={p.heading}
            style={{ padding: '10px 0 0', borderTop: `1px solid ${theme.border}` }}
          >
            <Text
              style={{ fontSize: '13.5px', fontWeight: 700, color: theme.ink, margin: '0 0 2px' }}
            >
              {p.heading}
            </Text>
            {p.items.map((item) => (
              <Text key={item} style={{ fontSize: '13px', color: theme.body, margin: 0 }}>
                {item}
              </Text>
            ))}
            {p.when ? (
              <Text style={{ fontSize: '12px', color: theme.muted, margin: '2px 0 8px' }}>
                {p.when}
              </Text>
            ) : null}
          </Section>
        ))}
      </Section>
    </Section>
  )
}

/** A dashed box for a code the shopper keeps: a gift card, or a coupon. */
export function CodeBox({
  colours,
  label,
  code,
  lines,
}: {
  colours: Colours
  label: string
  code: string
  lines?: (string | undefined)[] | undefined
}) {
  return (
    <Section style={{ padding: '24px 24px 0' }}>
      <Section
        style={{
          border: `2px dashed ${colours.bg}`,
          borderRadius: '18px',
          padding: '22px',
          textAlign: 'center',
        }}
      >
        <Text style={{ margin: '0 0 6px', fontSize: '12.5px', color: theme.muted }}>{label}</Text>
        <Text
          style={{
            margin: 0,
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: colours.bg,
            fontFamily: MONO,
          }}
        >
          {code}
        </Text>
        {(lines ?? []).filter(Boolean).map((l) => (
          <Text key={l} style={{ margin: '8px 0 0', fontSize: '13px', color: theme.body }}>
            {l}
          </Text>
        ))}
      </Section>
    </Section>
  )
}

/** Small grey pills under the button: "AWB 1490…", "Paid by UPI". */
export function MetaPills({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <Section style={{ padding: '12px 24px 0', textAlign: 'center' }}>
      <Text style={{ margin: 0 }}>
        {items.map((m) => (
          <span
            key={m}
            style={{
              display: 'inline-block',
              margin: '3px',
              padding: '6px 12px',
              borderRadius: '999px',
              backgroundColor: theme.panel,
              fontSize: '12.5px',
              color: theme.body,
            }}
          >
            {m}
          </span>
        ))}
      </Text>
    </Section>
  )
}

/** A labelled link line, for document/app links that aren't the primary button. */
export function LinkLine({ label, href }: { label: string; href: string }) {
  return (
    <Text
      style={{
        fontSize: '14px',
        lineHeight: '22px',
        margin: '0 0 6px',
        textAlign: 'center',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}
    >
      <Link href={href} style={{ color: theme.ink, fontWeight: 600, textDecoration: 'underline' }}>
        {label}
      </Link>
    </Text>
  )
}
