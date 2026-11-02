import { Button, Column, Img, Link, Row, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import type { TemplateData } from '../types'
import { theme } from './theme'

type Colours = { bg: string; fg: string }

/** What sits on the hero's right: a code, an amount, or the first product's photo. */
export type HeroShot =
  | { kind: 'code'; value: string; caption?: string | undefined }
  | { kind: 'amount'; value: string; caption?: string | undefined }
  | { kind: 'image'; url: string; alt: string }

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace"

function ShotCard({ shot }: { shot: HeroShot }) {
  if (shot.kind === 'image') {
    return (
      <Section
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          padding: '18px',
          textAlign: 'center',
        }}
      >
        <Img
          src={shot.url}
          alt={shot.alt}
          width="160"
          style={{ margin: '0 auto', maxWidth: '100%', height: 'auto', borderRadius: '10px' }}
        />
      </Section>
    )
  }
  return (
    <Section
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        padding: '26px 14px',
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: shot.kind === 'code' ? '30px' : '32px',
          lineHeight: '36px',
          fontWeight: 800,
          letterSpacing: shot.kind === 'code' ? '0.14em' : '-0.02em',
          fontFamily: shot.kind === 'code' ? MONO : undefined,
          color: theme.ink,
        }}
      >
        {shot.value}
      </Text>
      {shot.caption ? (
        <Text
          style={{ margin: '8px 0 0', fontSize: '12px', lineHeight: '17px', color: theme.muted }}
        >
          {shot.caption}
        </Text>
      ) : null}
    </Section>
  )
}

/** The full-colour opener: a small label, a big uppercase headline, one line, and the shot. */
export function Hero({
  colours,
  eyebrow,
  title,
  line,
  shot,
}: {
  colours: Colours
  eyebrow: string
  title: string
  line?: string | undefined
  shot?: HeroShot | undefined
}) {
  const words = (
    <>
      <Text
        style={{
          margin: '0 0 12px',
          fontSize: '11.5px',
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: colours.fg,
          opacity: 0.8,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        className="k-hero-title"
        style={{
          margin: '0 0 12px',
          fontSize: '36px',
          lineHeight: '38px',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          textTransform: 'uppercase',
          color: colours.fg,
        }}
      >
        {title}
      </Text>
      {line ? (
        <Text
          style={{
            margin: 0,
            fontSize: '14.5px',
            lineHeight: '22px',
            color: colours.fg,
            opacity: 0.88,
          }}
        >
          {line}
        </Text>
      ) : null}
    </>
  )
  return (
    <Section style={{ padding: '24px 24px 0' }}>
      <Section
        className="k-pad"
        style={{ backgroundColor: colours.bg, borderRadius: '22px', padding: '36px 32px' }}
      >
        {shot ? (
          <Row>
            <Column
              className="k-stack"
              style={{ width: '56%', verticalAlign: 'middle', paddingRight: '16px' }}
            >
              {words}
            </Column>
            <Column className="k-stack" style={{ width: '44%', verticalAlign: 'middle' }}>
              <ShotCard shot={shot} />
            </Column>
          </Row>
        ) : (
          words
        )}
      </Section>
    </Section>
  )
}

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

/** The message under the hero: a short heading and the text, centred. */
export function Intro({ heading, children }: { heading: string; children?: ReactNode }) {
  return (
    <Section className="k-pad" style={{ padding: '30px 40px 0', textAlign: 'center' }}>
      <Text
        style={{
          margin: '0 0 10px',
          fontSize: '22px',
          lineHeight: '28px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: theme.ink,
        }}
      >
        {heading}
      </Text>
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
        lineHeight: '24px',
        color: theme.body,
        margin: '0 0 14px',
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

/** The one button style every email uses: brand colour, always centred (owner rule). */
export function PrimaryButton({
  href,
  children,
  colours,
}: {
  href: string
  children: string
  colours: Colours
}) {
  return (
    <Section style={{ padding: '10px 24px 4px', textAlign: 'center' }}>
      <Button
        href={href}
        style={{
          backgroundColor: colours.bg,
          color: colours.fg,
          fontSize: '15px',
          fontWeight: 700,
          padding: '16px 30px',
          borderRadius: '12px',
          textDecoration: 'none',
          display: 'inline-block',
          minWidth: '180px',
          textAlign: 'center',
        }}
      >
        {children}
      </Button>
    </Section>
  )
}

type Line = TemplateData['lines'][number]
export type TaxLine = { label: string; amount: string }

/** The order panel: product photos, titles, prices, then shipping, the total and the GST inside. */
export function ItemsPanel({
  title,
  lines,
  colours,
  totalHeading,
  totalLabel,
  shipping,
  taxBreakdown,
  qty,
}: {
  title: string
  lines: Line[]
  colours: Colours
  totalHeading: string
  totalLabel?: string | undefined
  shipping?: TaxLine | undefined
  taxBreakdown?: TaxLine[] | undefined
  qty: (n: number) => string
}) {
  if (lines.length === 0) return null
  return (
    <Section style={{ padding: '30px 24px 0' }}>
      <Section
        style={{ backgroundColor: theme.panel, borderRadius: '20px', padding: '24px 24px 20px' }}
      >
        <Text style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 700, color: theme.ink }}>
          {title}
        </Text>
        {lines.map((line, i) => (
          <Row
            key={`${line.title}-${line.quantity}-${line.priceLabel}`}
            style={{ borderTop: i === 0 ? 'none' : '1px solid #e7e5e0' }}
          >
            <Column style={{ width: '84px', padding: '12px 0', verticalAlign: 'top' }}>
              {line.imageUrl ? (
                <Img
                  src={line.imageUrl}
                  width="72"
                  height="72"
                  alt={line.title}
                  style={{ borderRadius: '12px', backgroundColor: '#ffffff', objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                  }}
                />
              )}
            </Column>
            <Column style={{ padding: '14px 8px 12px 6px', verticalAlign: 'top' }}>
              <Text
                style={{
                  margin: '0 0 4px',
                  fontSize: '14.5px',
                  lineHeight: '20px',
                  fontWeight: 700,
                  color: theme.ink,
                }}
              >
                {line.title}
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontSize: '11.5px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: theme.muted,
                }}
              >
                {qty(line.quantity)}
              </Text>
              {line.note ? (
                <Text
                  style={{
                    margin: '6px 0 0',
                    fontSize: '12.5px',
                    lineHeight: '18px',
                    color: theme.muted,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {line.note}
                </Text>
              ) : null}
            </Column>
            <Column
              style={{
                width: '116px',
                padding: '14px 0 12px',
                verticalAlign: 'top',
                textAlign: 'right',
              }}
            >
              <Text style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: colours.bg }}>
                {line.priceLabel}
              </Text>
            </Column>
          </Row>
        ))}
        {totalLabel ? (
          <Section
            style={{ borderTop: '1px dashed #d9d6cf', marginTop: '6px', paddingTop: '14px' }}
          >
            {shipping ? (
              <Row>
                <Column>
                  <Text style={{ margin: '0 0 6px', fontSize: '13.5px', color: theme.body }}>
                    {shipping.label}
                  </Text>
                </Column>
                <Column style={{ textAlign: 'right' }}>
                  <Text style={{ margin: '0 0 6px', fontSize: '13.5px', color: theme.body }}>
                    {shipping.amount}
                  </Text>
                </Column>
              </Row>
            ) : null}
            <Row>
              <Column>
                <Text style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: theme.ink }}>
                  {totalHeading}
                </Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: theme.ink }}>
                  {totalLabel}
                </Text>
              </Column>
            </Row>
            {taxBreakdown?.length ? (
              <Text
                style={{
                  margin: '6px 0 0',
                  fontSize: '12px',
                  color: theme.faint,
                  textAlign: 'right',
                }}
              >
                Includes GST: {taxBreakdown.map((t) => `${t.label} ${t.amount}`).join(' · ')}
              </Text>
            ) : null}
          </Section>
        ) : null}
      </Section>
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
