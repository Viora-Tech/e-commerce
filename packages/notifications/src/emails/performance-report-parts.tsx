import { Column, Img, Link, Row, Section, Text } from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import type { PerformanceReport, ReportChange } from '../report-types'

/**
 * The pieces of the team's performance report (emails/performance-report.tsx). Only that email
 * uses them; the shared email blocks live elsewhere. Sizes are px on purpose: Outlook and Gmail
 * ignore rem in email HTML.
 */
export const C = {
  ink: '#161615',
  body: '#55534d',
  muted: '#8a8882',
  border: '#e8e6e1',
  up: '#15803d',
  upBg: '#e8f5ec',
  down: '#b42318',
  downBg: '#fdecea',
  purple: '#6d28d9',
  purpleBg: '#f7f4fe',
  bar: '#e4e2dd',
  track: '#f1efeb',
  other: '#3a3a3a',
  band: '#141414',
  lightBand: '#f6f5f2',
  footer: '#f6f5f2',
} as const

export const FONT = "'Times New Roman', Times, Georgia, serif"
const BAR_MAX = 86

export const text = (s: CSSProperties): CSSProperties => ({ margin: 0, fontFamily: FONT, ...s })

function Change({ change, note }: { change: ReportChange | null; note?: string }) {
  if (!change) return null
  return (
    <span style={{ color: change.up ? C.up : C.down, fontSize: '12px' }}>
      {change.label}
      {note ? ` ${note}` : ''}
    </span>
  )
}

/** The green or red pill next to the big number. */
export function ChangePill({ change }: { change: ReportChange }) {
  return (
    <span
      style={{
        backgroundColor: change.up ? C.upBg : C.downBg,
        color: change.up ? C.up : C.down,
        fontWeight: 700,
        borderRadius: '20px',
        padding: '3px 10px',
        marginRight: '8px',
      }}
    >
      {change.label}
    </span>
  )
}

/** A centred caps label between two thin lines. */
export function Divider({ children }: { children: string }) {
  return (
    <Row style={{ margin: '0 0 18px' }}>
      <Column style={{ borderBottom: `1px solid ${C.border}` }}>&nbsp;</Column>
      <Column style={{ width: '1%', whiteSpace: 'nowrap', padding: '0 14px' }}>
        <Text
          style={text({ fontSize: '11px', letterSpacing: '2.2px', textTransform: 'uppercase' })}
        >
          {children}
        </Text>
      </Column>
      <Column style={{ borderBottom: `1px solid ${C.border}` }}>&nbsp;</Column>
    </Row>
  )
}

/** A section of the white card: 40px in from the card's edges (20px on a phone). */
export function Block({ children, top = 36 }: { children: ReactNode; top?: number }) {
  return (
    <Section className="r-pad" style={{ padding: `${top}px 40px 0` }}>
      {children}
    </Section>
  )
}

export function Bars({ bars }: { bars: PerformanceReport['bars'] }) {
  const max = Math.max(...bars.map((b) => b.value), 1)
  return (
    <Row>
      {bars.map((b) => (
        <Column
          key={b.label}
          style={{ verticalAlign: 'bottom', textAlign: 'center', padding: '0 4px' }}
        >
          <Text
            style={text({
              fontSize: '12px',
              color: b.best ? C.ink : C.muted,
              fontWeight: b.best ? 700 : 400,
              paddingBottom: '6px',
            })}
          >
            {b.valueLabel}
          </Text>
          <div
            style={{
              height: `${Math.max(4, Math.round((b.value / max) * BAR_MAX))}px`,
              backgroundColor: b.best ? C.purple : C.bar,
              borderRadius: '3px 3px 0 0',
              lineHeight: '1px',
              fontSize: '1px',
            }}
          >
            &nbsp;
          </div>
          <Text
            style={text({
              fontSize: '12px',
              color: b.best ? C.ink : C.muted,
              fontWeight: b.best ? 700 : 400,
              paddingTop: '6px',
            })}
          >
            {b.label}
          </Text>
        </Column>
      ))}
    </Row>
  )
}

export function Stats({ report }: { report: PerformanceReport }) {
  const rows: PerformanceReport['stats'][] = []
  for (let i = 0; i < report.stats.length; i += 3) rows.push(report.stats.slice(i, i + 3))
  return (
    <>
      {rows.map((row, ri) => (
        <Row
          key={row.map((s) => s.label).join()}
          style={ri ? { borderTop: `1px solid ${C.border}` } : {}}
        >
          {row.map((s, ci) => (
            <Column
              key={s.label}
              style={{
                width: '33.3%',
                verticalAlign: 'top',
                padding: `18px 0 18px ${ci ? 18 : 0}px`,
                borderLeft: ci ? `1px solid ${C.border}` : 'none',
              }}
            >
              <Text style={text({ fontSize: '14px', fontStyle: 'italic', color: C.purple })}>
                {s.label}
              </Text>
              <Text style={text({ fontSize: '28px', lineHeight: '34px', color: C.ink })}>
                {s.value}
              </Text>
              <Text style={text({ fontSize: '12px' })}>
                <Change change={s.change} note={report.vsLabel} />
              </Text>
            </Column>
          ))}
        </Row>
      ))}
    </>
  )
}

export function History({ items }: { items: PerformanceReport['history'] }) {
  return (
    <Row>
      {items.map((h, i) => {
        const now = i === items.length - 1
        return (
          <Column
            key={h.label}
            style={{
              textAlign: 'center',
              padding: '12px 2px',
              borderTop: now ? `3px solid ${C.purple}` : `1px solid ${C.border}`,
            }}
          >
            <Text
              style={text({
                fontSize: '12px',
                color: now ? C.purple : C.muted,
                fontWeight: now ? 700 : 400,
              })}
            >
              {h.label}
            </Text>
            <Text style={text({ fontSize: '18px', color: C.ink, fontWeight: now ? 700 : 400 })}>
              {h.value}
            </Text>
          </Column>
        )
      })}
    </Row>
  )
}

export function Sellers({ sellers }: { sellers: PerformanceReport['sellers'] }) {
  return (
    <>
      {sellers.map((s, i) => (
        <Row key={s.title} style={i ? { borderTop: '1px solid #f0eeea' } : {}}>
          <Column style={{ width: '30px', padding: '14px 0', verticalAlign: 'middle' }}>
            <Text style={text({ fontSize: '30px', fontStyle: 'italic', color: C.purple })}>
              {i + 1}
            </Text>
          </Column>
          <Column style={{ width: '92px', padding: '14px 0', verticalAlign: 'middle' }}>
            {s.imageUrl ? (
              <Img
                src={s.imageUrl}
                alt=""
                width={76}
                height={76}
                style={{
                  border: '1px solid #e6e6e3',
                  borderRadius: '6px',
                  objectFit: 'contain',
                  backgroundColor: '#ffffff',
                }}
              />
            ) : (
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '6px',
                  backgroundColor: C.track,
                }}
              />
            )}
          </Column>
          <Column style={{ padding: '14px 12px 14px 0', verticalAlign: 'middle' }}>
            <Text style={text({ fontSize: '16px', fontWeight: 700, color: C.ink })}>{s.title}</Text>
            {s.detail ? (
              <Text style={text({ fontSize: '14px', color: C.body })}>{s.detail}</Text>
            ) : null}
            <Text style={text({ fontSize: '14px', fontStyle: 'italic', color: C.muted })}>
              {s.soldLabel}
            </Text>
          </Column>
          <Column style={{ padding: '14px 0', verticalAlign: 'middle', textAlign: 'right' }}>
            <Text style={text({ fontSize: '17px', color: C.ink, whiteSpace: 'nowrap' })}>
              {s.amountLabel}
            </Text>
          </Column>
        </Row>
      ))}
    </>
  )
}

/** Bars against the top source, so the biggest fills its track; the top one is purple. */
export function Sources({ sources }: { sources: PerformanceReport['sources'] }) {
  const top = Math.max(...sources.map((s) => s.percent), 1)
  return (
    <>
      {sources.map((s, i) => (
        <Row key={s.label}>
          <Column style={{ width: '96px', padding: '0 0 14px' }}>
            <Text style={text({ fontSize: '15px', color: C.body })}>{s.label}</Text>
          </Column>
          <Column style={{ padding: '0 14px 14px 0' }}>
            <div style={{ backgroundColor: C.track, borderRadius: '5px', height: '10px' }}>
              <div
                style={{
                  width: `${Math.max(2, Math.round((s.percent / top) * 92))}%`,
                  height: '10px',
                  borderRadius: '5px',
                  backgroundColor: i ? C.other : C.purple,
                  fontSize: '1px',
                  lineHeight: '1px',
                }}
              >
                &nbsp;
              </div>
            </div>
          </Column>
          <Column style={{ width: '44px', padding: '0 0 14px', textAlign: 'right' }}>
            <Text style={text({ fontSize: '15px', fontWeight: 700, color: C.ink })}>
              {s.percent}%
            </Text>
          </Column>
        </Row>
      ))}
    </>
  )
}

/** The purple box of things to act on, each with its icon in a white circle and a link. */
export function Todos({ report }: { report: PerformanceReport }) {
  return (
    <Section
      style={{
        backgroundColor: C.purpleBg,
        borderLeft: `3px solid ${C.purple}`,
        padding: '22px 24px 8px',
      }}
    >
      <Text style={text({ fontSize: '19px', color: C.ink, paddingBottom: '14px' })}>
        {report.todoTitle}
      </Text>
      {report.todos.map((t) => (
        <Row key={t.text}>
          <Column style={{ width: '44px', verticalAlign: 'top', paddingBottom: '14px' }}>
            <Text
              style={text({
                width: '32px',
                height: '32px',
                lineHeight: '32px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                textAlign: 'center',
                fontSize: '14px',
              })}
            >
              {t.icon}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top', paddingBottom: '14px' }}>
            <Text style={text({ fontSize: '15px', lineHeight: '21px', color: C.body })}>
              {t.text}
              <br />
              <Link
                href={t.url}
                style={{ color: C.purple, fontWeight: 700, textDecoration: 'underline' }}
              >
                {t.linkLabel} →
              </Link>
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  )
}

/** Gross, discounts and refunds, then the net line under a rule. */
export function Money({ report, netTitle }: { report: PerformanceReport; netTitle: string }) {
  return (
    <>
      {report.money.map((m) => (
        <Row key={m.label}>
          <Column style={{ padding: '0 0 9px' }}>
            <Text style={text({ fontSize: '16px', color: C.body })}>{m.label}</Text>
          </Column>
          <Column style={{ padding: '0 0 9px', textAlign: 'right' }}>
            <Text style={text({ fontSize: '16px', color: C.body })}>{m.amount}</Text>
          </Column>
        </Row>
      ))}
      <Row style={{ borderTop: `1px solid ${C.ink}` }}>
        <Column style={{ paddingTop: '14px' }}>
          <Text style={text({ fontSize: '24px', color: C.ink })}>{netTitle}</Text>
        </Column>
        <Column style={{ paddingTop: '14px', textAlign: 'right' }}>
          <Text style={text({ fontSize: '24px', fontWeight: 700, color: C.ink })}>
            {report.netLabel}
          </Text>
        </Column>
      </Row>
    </>
  )
}
