import { Column, Link, Row, Section, Text } from '@react-email/components'
import { theme } from '../theme'
import { CAPS, type Tone, toneColours } from './tokens'

/** A box with a coloured left edge: "What changed", "Why", "This cannot be undone". */
export type NoticeBlock = {
  kind: 'notice'
  tone: Tone
  title: string
  body?: string | undefined
  link?: { label: string; url: string } | undefined
  /** A merchant's own colours from Edit design, over the tone's. */
  colours?: { ink?: string | undefined; bg?: string | undefined } | undefined
}

/** A box with a round icon: "Checked and accepted" (✓), "Changed on 19 Nov" (i), "Not paid" (!). */
export type StatusBlock = {
  kind: 'status'
  tone: Tone
  title: string
  body?: string | undefined
  /** A merchant's own colours from Edit design, over the tone's. */
  colours?: { ink?: string | undefined; bg?: string | undefined } | undefined
}

/** Label / value rows in a ruled card: refund details, invoice number, bank details. */
export type FactsBlock = {
  kind: 'facts'
  rows: { label: string; value: string; strong?: boolean | undefined }[]
  /** `soft`: grey fill with caps labels stacked over values (a form message, an application). */
  look?: 'card' | 'soft' | undefined
}

/** Two or three boxes side by side: "Refunded ₹3,499" / "Reaches you in 5–7 working days". */
export type StatsBlock = {
  kind: 'stats'
  items: { label: string; value: string; tone?: Tone | undefined }[]
}

/** Shipping to · Payment · Ordered on: columns of lines under an italic label. */
export type ColumnsBlock = {
  kind: 'columns'
  items: { label: string; lines: string[] }[]
}

/** Someone's words in a soft box: "You wrote", "Waimers replied", "Asha asked". */
export type QuoteBlock = {
  kind: 'quote'
  label: string
  text: string
  tone?: Tone | undefined
}

const ICON: Record<Tone, string> = { good: '✓', bad: '!', accent: 'i', neutral: 'i' }

export function Notice({ block: b, accent }: { block: NoticeBlock; accent: string }) {
  const c = { ...toneColours(b.tone, accent), ...b.colours }
  return (
    <Section
      style={{ backgroundColor: c.bg, borderLeft: `3px solid ${c.ink}`, padding: '16px 20px' }}
    >
      <Text style={{ margin: 0, fontSize: '16px', lineHeight: '22px', color: theme.ink }}>
        {b.title}
      </Text>
      {b.body ? (
        <Text
          style={{
            margin: '4px 0 0',
            fontSize: '13.5px',
            lineHeight: '20px',
            color: theme.body,
            whiteSpace: 'pre-line',
          }}
        >
          {b.body}
        </Text>
      ) : null}
      {b.link ? (
        <Text style={{ margin: '6px 0 0', fontSize: '13.5px' }}>
          <Link
            href={b.link.url}
            style={{ color: c.ink, fontWeight: 700, textDecoration: 'underline' }}
          >
            {b.link.label} →
          </Link>
        </Text>
      ) : null}
    </Section>
  )
}

export function Status({ block: b, accent }: { block: StatusBlock; accent: string }) {
  const c = { ...toneColours(b.tone, accent), ...b.colours }
  return (
    <Row style={{ backgroundColor: c.bg, borderRadius: '8px' }}>
      <Column style={{ width: '64px', padding: '16px 0 16px 18px', verticalAlign: 'middle' }}>
        <div
          style={{
            width: '34px',
            height: '34px',
            lineHeight: '34px',
            borderRadius: '17px',
            backgroundColor: c.ink,
            color: '#ffffff',
            fontSize: '18px',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {ICON[b.tone]}
        </div>
      </Column>
      <Column style={{ padding: '16px 18px 16px 0', verticalAlign: 'middle' }}>
        <Text style={{ margin: 0, fontSize: '16px', lineHeight: '22px', color: theme.ink }}>
          {b.title}
        </Text>
        {b.body ? (
          <Text
            style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: '18px', color: theme.body }}
          >
            {b.body}
          </Text>
        ) : null}
      </Column>
    </Row>
  )
}

export function Facts({ block: b }: { block: FactsBlock }) {
  if (b.look === 'soft') {
    return (
      <Section style={{ backgroundColor: theme.soft, borderRadius: '8px', padding: '16px 20px' }}>
        {b.rows.map((r, i) => (
          <Section key={r.label} style={{ paddingTop: i === 0 ? 0 : '12px' }}>
            <Text style={CAPS}>{r.label}</Text>
            <Text
              style={{
                margin: '2px 0 0',
                fontSize: '14px',
                lineHeight: '20px',
                color: theme.ink,
                whiteSpace: 'pre-line',
              }}
            >
              {r.value}
            </Text>
          </Section>
        ))}
      </Section>
    )
  }
  return (
    <Section
      style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '4px 20px' }}
    >
      {b.rows.map((r, i) => (
        <Row key={r.label} style={{ borderTop: i === 0 ? 'none' : `1px solid ${theme.hairline}` }}>
          <Column style={{ padding: '12px 0' }}>
            <Text style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: theme.body }}>
              {r.label}
            </Text>
          </Column>
          <Column style={{ padding: '12px 0', textAlign: 'right' }}>
            <Text
              style={{
                margin: 0,
                fontSize: r.strong ? '15px' : '14px',
                lineHeight: '20px',
                fontWeight: r.strong ? 700 : 400,
                color: theme.ink,
              }}
            >
              {r.value}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  )
}

export function Stats({ block: b, accent }: { block: StatsBlock; accent: string }) {
  return (
    <Row>
      {b.items.map((s, i) => {
        const c = toneColours(s.tone ?? 'neutral', accent)
        return (
          <Column
            key={s.label}
            className="k-stack"
            style={{
              width: `${100 / b.items.length}%`,
              padding: i === 0 ? '0 6px 0 0' : '0 0 0 6px',
              verticalAlign: 'top',
            }}
          >
            <Section style={{ backgroundColor: c.bg, borderRadius: '8px', padding: '14px 18px' }}>
              <Text
                style={{
                  margin: 0,
                  fontSize: '12.5px',
                  fontStyle: 'italic',
                  color: s.tone ? c.ink : theme.muted,
                }}
              >
                {s.label}
              </Text>
              <Text
                style={{
                  margin: '2px 0 0',
                  fontSize: '22px',
                  lineHeight: '28px',
                  color: theme.ink,
                }}
              >
                {s.value}
              </Text>
            </Section>
          </Column>
        )
      })}
    </Row>
  )
}

export function Columns({ block: b, accent }: { block: ColumnsBlock; accent: string }) {
  return (
    <Row>
      {b.items.map((f) => (
        <Column
          key={f.label}
          className="k-stack"
          style={{ width: `${100 / b.items.length}%`, verticalAlign: 'top', paddingBottom: '12px' }}
        >
          <Text style={{ margin: '0 0 3px', fontSize: '13px', fontStyle: 'italic', color: accent }}>
            {f.label}
          </Text>
          {f.lines.map((l) => (
            <Text
              key={l}
              style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: theme.ink }}
            >
              {l}
            </Text>
          ))}
        </Column>
      ))}
    </Row>
  )
}

export function Quote({ block: b, accent }: { block: QuoteBlock; accent: string }) {
  const c = toneColours(b.tone ?? 'neutral', accent)
  return (
    <Section style={{ backgroundColor: c.bg, borderRadius: '8px', padding: '14px 18px' }}>
      <Text style={{ ...CAPS, color: b.tone ? c.ink : theme.muted }}>{b.label}</Text>
      <Text
        style={{
          margin: '4px 0 0',
          fontSize: '15px',
          lineHeight: '22px',
          fontStyle: 'italic',
          color: theme.ink,
          whiteSpace: 'pre-line',
        }}
      >
        “{b.text}”
      </Text>
    </Section>
  )
}
