import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'
import type { PerformanceReport, ReportChange } from '../report-types'
import type { EmailBrandInfo } from '../types'

export type PerformanceReportEmailProps = {
  storeName: string
  brand?: EmailBrandInfo | undefined
  previewText: string
  report: PerformanceReport
}

/**
 * The team's performance report (owner, 19 Nov 2026 Figma "Performance emails · final"): Times
 * New Roman throughout, the store's logo on a black band, purple only on what matters most (the
 * best bar, this period, the top source, the links). Times is on every computer and phone, so
 * Gmail and Outlook show the same type as Apple Mail. Tables and inline styles only.
 */
const C = {
  ink: '#161615',
  body: '#55534d',
  muted: '#8a8882',
  border: '#e8e6e1',
  up: '#15803d',
  down: '#b42318',
  purple: '#6d28d9',
  purpleBg: '#f7f4fe',
  bar: '#e4e2dd',
  track: '#f1efeb',
  band: '#141414',
  lightBand: '#f6f5f2',
  footer: '#f6f5f2',
} as const

const FONT = "'Times New Roman', Times, Georgia, serif"
const BAR_MAX = 86

const RESPONSIVE = `
@media only screen and (max-width: 560px) {
  .r-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .r-band { padding-left: 12px !important; padding-right: 12px !important; }
  .r-title { font-size: 32px !important; line-height: 36px !important; }
  .r-net { font-size: 44px !important; line-height: 48px !important; }
  .r-hide { display: none !important; }
}`

const text = (s: CSSProperties): CSSProperties => ({ margin: 0, fontFamily: FONT, ...s })

function Change({ change, note }: { change: ReportChange | null; note?: string }) {
  if (!change) return null
  return (
    <span style={{ color: change.up ? C.up : C.down, fontSize: '12px' }}>
      {change.label}
      {note ? ` ${note}` : ''}
    </span>
  )
}

/** A centred caps label between two thin lines. */
function Divider({ children }: { children: string }) {
  return (
    <Row style={{ margin: '0 0 18px' }}>
      <Column style={{ borderBottom: `1px solid ${C.border}` }}>&nbsp;</Column>
      <Column style={{ width: '1%', whiteSpace: 'nowrap', padding: '0 14px' }}>
        <Text style={text({ fontSize: '11px', letterSpacing: '2.2px', textTransform: 'uppercase' })}>
          {children}
        </Text>
      </Column>
      <Column style={{ borderBottom: `1px solid ${C.border}` }}>&nbsp;</Column>
    </Row>
  )
}

function Block({ children, top = 36 }: { children: ReactNode; top?: number }) {
  return (
    <Section className="r-pad" style={{ padding: `${top}px 72px 0` }}>
      {children}
    </Section>
  )
}

function Bars({ bars }: { bars: PerformanceReport['bars'] }) {
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

function Stats({ report }: { report: PerformanceReport }) {
  const rows: PerformanceReport['stats'][] = []
  for (let i = 0; i < report.stats.length; i += 3) rows.push(report.stats.slice(i, i + 3))
  return (
    <>
      {rows.map((row, ri) => (
        <Row key={row.map((s) => s.label).join()} style={ri ? { borderTop: `1px solid ${C.border}` } : {}}>
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

function History({ items }: { items: PerformanceReport['history'] }) {
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

function Sellers({ sellers }: { sellers: PerformanceReport['sellers'] }) {
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
                style={{ width: '76px', height: '76px', borderRadius: '6px', backgroundColor: C.track }}
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

function Sources({ sources }: { sources: PerformanceReport['sources'] }) {
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
                  width: `${Math.max(2, Math.round((s.percent / top) * 100))}%`,
                  height: '10px',
                  borderRadius: '5px',
                  backgroundColor: i ? '#3a3a3a' : C.purple,
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

function Todos({ report }: { report: PerformanceReport }) {
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
        <Text key={t.text} style={text({ fontSize: '15px', color: C.body, paddingBottom: '14px' })}>
          {t.text}
          <br />
          <Link href={t.url} style={{ color: C.purple, fontWeight: 700, textDecoration: 'underline' }}>
            {t.linkLabel} →
          </Link>
        </Text>
      ))}
    </Section>
  )
}

function Money({ report }: { report: PerformanceReport }) {
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
          <Text style={text({ fontSize: '24px', color: C.ink })}>Net sales</Text>
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

/** The logo on the band: the dark-background logo on black, else the normal one on a light band. */
function Band({ storeName, brand }: { storeName: string; brand?: EmailBrandInfo | undefined }) {
  const dark = brand?.logoDarkUrl ?? null
  const logo = dark ?? brand?.logoUrl ?? null
  const width = Math.min(Math.max(brand?.logoWidth ?? 160, 100), 220)
  return (
    <Section style={{ padding: '44px 24px 40px', textAlign: 'center' }}>
      {logo ? (
        <Img src={logo} alt={storeName} width={width} style={{ margin: '0 auto', height: 'auto' }} />
      ) : (
        <Text
          style={text({
            fontSize: '26px',
            letterSpacing: '6px',
            textTransform: 'uppercase',
            color: dark || !brand?.logoUrl ? '#ffffff' : C.ink,
          })}
        >
          {storeName}
        </Text>
      )}
    </Section>
  )
}

export function PerformanceReportEmail({ storeName, brand, previewText, report: r }: PerformanceReportEmailProps) {
  // Black only when the store has a logo made for it (or none at all: the name is drawn in white).
  const bandColour = brand?.logoDarkUrl || !brand?.logoUrl ? C.band : C.lightBand
  const best = r.bars.find((b) => b.best)
  return (
    <Html>
      <Head>
        <style>{RESPONSIVE}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: '#ffffff', fontFamily: FONT, color: C.ink }}>
        <Container style={{ maxWidth: '640px', width: '100%', margin: '0 auto' }}>
          <Section style={{ backgroundColor: bandColour }}>
            <Band storeName={storeName} brand={brand} />
            <Section className="r-band" style={{ padding: '0 32px' }}>
              <Section
                className="r-pad"
                style={{ backgroundColor: '#ffffff', padding: '44px 40px 8px', textAlign: 'center' }}
              >
                <Text
                  style={text({
                    fontSize: '12px',
                    letterSpacing: '2.6px',
                    textTransform: 'uppercase',
                    color: C.purple,
                    paddingBottom: '14px',
                  })}
                >
                  {r.kicker}
                </Text>
                <Text className="r-title" style={text({ fontSize: '42px', lineHeight: '46px', color: C.ink })}>
                  {r.title}
                </Text>
                <Text style={text({ fontSize: '17px', fontStyle: 'italic', color: C.body, paddingTop: '8px' })}>
                  {r.periodLabel}
                </Text>
              </Section>
            </Section>
          </Section>

          <Block top={28}>
            <Section
              style={{
                backgroundColor: C.purpleBg,
                borderRadius: '6px',
                padding: '28px 22px 24px',
                textAlign: 'center',
              }}
            >
              <Text style={text({ fontSize: '15px', fontStyle: 'italic', color: C.purple })}>
                Net sales
              </Text>
              <Text className="r-net" style={text({ fontSize: '60px', lineHeight: '66px', color: C.ink })}>
                {r.netLabel}
              </Text>
              <Text style={text({ fontSize: '13px', color: C.body, padding: '8px 0 22px' })}>
                {r.change ? (
                  <span
                    style={{
                      backgroundColor: r.change.up ? '#e8f5ec' : '#fdecea',
                      color: r.change.up ? C.up : C.down,
                      fontWeight: 700,
                      borderRadius: '20px',
                      padding: '3px 10px',
                      marginRight: '8px',
                    }}
                  >
                    {r.change.label}
                  </span>
                ) : null}
                {r.changeNote}
              </Text>
              {r.bars.length > 0 && best ? <Bars bars={r.bars} /> : null}
              {r.barNote ? (
                <Text style={text({ fontSize: '13px', fontStyle: 'italic', color: C.body, paddingTop: '12px' })}>
                  {r.barNote}
                </Text>
              ) : null}
            </Section>
          </Block>

          <Block top={22}>
            <Stats report={r} />
          </Block>

          {r.history.length > 1 ? (
            <Block>
              <Divider>{r.historyTitle}</Divider>
              <History items={r.history} />
            </Block>
          ) : null}

          <Section style={{ padding: '30px 24px 0', textAlign: 'center' }}>
            <Link
              href={r.button.url}
              style={{
                display: 'inline-block',
                backgroundColor: C.band,
                color: '#ffffff',
                fontFamily: FONT,
                fontSize: '16px',
                padding: '14px 30px',
                borderRadius: '4px',
                textDecoration: 'none',
              }}
            >
              {r.button.label} →
            </Link>
          </Section>

          {r.todosFirst && r.todos.length > 0 ? (
            <Block top={40}>
              <Todos report={r} />
            </Block>
          ) : null}

          {r.sellers.length > 0 ? (
            <Block top={40}>
              <Divider>{r.sellersTitle}</Divider>
              <Sellers sellers={r.sellers} />
            </Block>
          ) : null}

          {r.sources.length > 0 ? (
            <Block>
              <Divider>Where your buyers came from</Divider>
              <Sources sources={r.sources} />
            </Block>
          ) : null}

          {!r.todosFirst && r.todos.length > 0 ? (
            <Block top={24}>
              <Todos report={r} />
            </Block>
          ) : null}

          <Block>
            <Divider>{r.moneyTitle}</Divider>
            <Money report={r} />
          </Block>

          <Section style={{ padding: '44px 0 0' }}>
            <Section
              className="r-pad"
              style={{ backgroundColor: C.footer, padding: '28px 40px 30px', textAlign: 'center' }}
            >
              <Text style={text({ fontSize: '13px', fontWeight: 700, color: C.ink, paddingBottom: '10px' })}>
                {storeName}
                <span style={{ color: C.muted }}> · </span>
                <Link href={r.button.url} style={{ color: C.ink }}>
                  {r.button.label}
                </Link>
                <span style={{ color: C.muted }}> · </span>
                <Link href={r.settingsUrl} style={{ color: C.ink }}>
                  Notification settings
                </Link>
              </Text>
              <Text style={text({ fontSize: '13px', lineHeight: '19px', color: C.body })}>
                {r.footer}
                <br />
                Cancelled, draft and test orders are left out of every figure.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
