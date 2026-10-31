import { Button, Column, Img, Link, Row, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import type { TemplateData } from '../types'
import { theme } from './theme'

/** Small uppercase label above a heading, e.g. "ORDER #42". */
export function Eyebrow({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: theme.muted,
        margin: '0 0 8px',
      }}
    >
      {children}
    </Text>
  )
}

export function Heading({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: '22px',
        fontWeight: 700,
        color: theme.ink,
        margin: '0 0 16px',
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </Text>
  )
}

export function Body({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: '14px', lineHeight: '22px', color: theme.ink, margin: '0 0 16px' }}>
      {children}
    </Text>
  )
}

/** The one button style every email uses: solid ink, white text. */
export function PrimaryButton({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ margin: '8px 0 24px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: theme.ink,
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          padding: '12px 24px',
          borderRadius: '10px',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        {children}
      </Button>
    </Section>
  )
}

type Line = TemplateData['lines'][number] & { imageUrl?: string | undefined }

/** Line-item table with an optional product thumbnail per row. */
export function ItemsTable({ lines }: { lines: Line[] }) {
  if (lines.length === 0) return null
  return (
    <Section style={{ margin: '0 0 16px' }}>
      <Eyebrow>Items</Eyebrow>
      {lines.map((line, i) => (
        <Row
          key={`${line.title}-${line.quantity}-${line.priceLabel}`}
          style={{ borderTop: i === 0 ? 'none' : `1px solid ${theme.border}`, padding: '10px 0' }}
        >
          <Column style={{ width: '44px', verticalAlign: 'top' }}>
            {line.imageUrl ? (
              <Img
                src={line.imageUrl}
                width="40"
                height="40"
                alt={line.title}
                style={{
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: `1px solid ${theme.border}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: theme.bg,
                  border: `1px solid ${theme.border}`,
                }}
              />
            )}
          </Column>
          <Column style={{ verticalAlign: 'top', paddingLeft: '12px' }}>
            <Text style={{ fontSize: '13px', color: theme.ink, margin: 0, fontWeight: 500 }}>
              {line.title}
            </Text>
            <Text style={{ fontSize: '12px', color: theme.muted, margin: '2px 0 0' }}>
              Qty {line.quantity}
            </Text>
            {line.note ? (
              <Text
                style={{
                  fontSize: '12px',
                  color: theme.muted,
                  margin: '4px 0 0',
                  whiteSpace: 'pre-line',
                }}
              >
                {line.note}
              </Text>
            ) : null}
          </Column>
          <Column style={{ verticalAlign: 'top', textAlign: 'right', width: '90px' }}>
            <Text style={{ fontSize: '13px', color: theme.ink, margin: 0 }}>{line.priceLabel}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  )
}

export type TaxLine = { label: string; amount: string }

/**
 * Totals block: shipping above the bold grand total, and the GST inside the prices as one small
 * "Includes GST" line under it. Rows above the total read as tax added on top (audit #189).
 */
export function TotalsBlock({
  totalLabel,
  shipping,
  taxBreakdown,
}: {
  totalLabel: string
  shipping?: TaxLine | undefined
  taxBreakdown?: TaxLine[] | undefined
}) {
  return (
    <Section
      style={{ margin: '0 0 8px', paddingTop: '8px', borderTop: `1px solid ${theme.border}` }}
    >
      {(shipping ? [shipping] : []).map((t) => (
        <Row key={t.label} style={{ padding: '2px 0' }}>
          <Column>
            <Text style={{ fontSize: '12px', color: theme.muted, margin: 0 }}>{t.label}</Text>
          </Column>
          <Column style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: '12px', color: theme.muted, margin: 0 }}>{t.amount}</Text>
          </Column>
        </Row>
      ))}
      <Row style={{ padding: '6px 0 0' }}>
        <Column>
          <Text style={{ fontSize: '14px', fontWeight: 700, color: theme.ink, margin: 0 }}>
            Total
          </Text>
        </Column>
        <Column style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: '14px', fontWeight: 700, color: theme.ink, margin: 0 }}>
            {totalLabel}
          </Text>
        </Column>
      </Row>
      {taxBreakdown?.length ? (
        <Text
          style={{ fontSize: '12px', color: theme.muted, margin: '4px 0 0', textAlign: 'right' }}
        >
          Includes GST: {taxBreakdown.map((t) => `${t.label} ${t.amount}`).join(' · ')}
        </Text>
      ) : null}
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
    <Section
      style={{
        margin: '8px 0 16px',
        padding: '16px',
        border: `1px solid ${theme.border}`,
        borderRadius: '10px',
      }}
    >
      <Text style={{ fontSize: '14px', fontWeight: 700, color: theme.ink, margin: '0 0 4px' }}>
        {title}
      </Text>
      <Text style={{ fontSize: '12px', lineHeight: '18px', color: theme.muted, margin: '0 0 8px' }}>
        {note}
      </Text>
      {parcels.map((p) => (
        <Section
          key={p.heading}
          style={{ padding: '8px 0 0', borderTop: `1px solid ${theme.border}` }}
        >
          <Text style={{ fontSize: '13px', fontWeight: 600, color: theme.ink, margin: '0 0 2px' }}>
            {p.heading}
          </Text>
          {p.items.map((item) => (
            <Text key={item} style={{ fontSize: '13px', color: theme.ink, margin: 0 }}>
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
  )
}

export function GiftCardBlock({
  code,
  balanceLabel,
  message,
}: {
  code: string
  balanceLabel: string
  message?: string | undefined
}) {
  return (
    <Section
      style={{
        backgroundColor: theme.bg,
        borderRadius: '12px',
        padding: '20px',
        margin: '0 0 16px',
        textAlign: 'center',
      }}
    >
      <Eyebrow>Gift card code</Eyebrow>
      <Text
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: theme.ink,
          margin: '0 0 8px',
        }}
      >
        {code}
      </Text>
      <Text style={{ fontSize: '13px', color: theme.ink, margin: 0 }}>Balance: {balanceLabel}</Text>
      {message ? (
        <Text
          style={{ fontSize: '13px', color: theme.muted, margin: '8px 0 0', fontStyle: 'italic' }}
        >
          {message}
        </Text>
      ) : null}
    </Section>
  )
}

/** A labelled link line, for document/app links that aren't the primary button. */
export function LinkLine({ label, href }: { label: string; href: string }) {
  return (
    <Text style={{ fontSize: '14px', lineHeight: '22px', color: theme.ink, margin: '0 0 8px' }}>
      <Link href={href} style={{ color: theme.ink, textDecoration: 'underline' }}>
        {label}
      </Link>
    </Text>
  )
}

/** Big monospace one-time code, for login_code. */
export function CodeBlock({ code }: { code: string }) {
  return (
    <Section
      style={{
        backgroundColor: theme.bg,
        borderRadius: '12px',
        padding: '20px',
        margin: '0 0 16px',
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '28px',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: theme.ink,
          margin: 0,
        }}
      >
        {code}
      </Text>
    </Section>
  )
}
