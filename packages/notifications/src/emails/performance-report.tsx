import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { PerformanceReport } from '../report-types'
import type { ReportWords } from '../templates/content-reports'
import type { EmailBrandInfo } from '../types'
import {
  Bars,
  Block,
  C,
  ChangePill,
  Divider,
  FONT,
  History,
  Money,
  Sellers,
  Sources,
  Stats,
  Todos,
  text,
} from './performance-report-parts'

export type PerformanceReportEmailProps = {
  storeName: string
  brand?: EmailBrandInfo | undefined
  previewText: string
  report: PerformanceReport
  words: ReportWords
}

/**
 * The team's performance report (owner, 19 Nov 2026 Figma "Weekly report · final" and "Monthly
 * report · final", Moodboard → Batch 10 · Reports): Times New Roman throughout, the store's logo on
 * a black band behind the top of a white card, purple only on what matters most (the best bar,
 * this period, the top source, the links). Times is on every computer and phone, so Gmail and
 * Outlook show the same type as Apple Mail. Tables and inline styles only.
 */
const RESPONSIVE = `
@media only screen and (max-width: 560px) {
  .r-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .r-band { padding-left: 12px !important; padding-right: 12px !important; }
  .r-title { font-size: 32px !important; line-height: 36px !important; }
  .r-net { font-size: 44px !important; line-height: 48px !important; }
}`

const CARD_SHADOW = '0 12px 40px rgba(20, 20, 20, 0.08)'

/** The logo on the band: the dark-background logo on black, else the normal one on a light band. */
function Band({ storeName, brand }: { storeName: string; brand?: EmailBrandInfo | undefined }) {
  const dark = brand?.logoDarkUrl ?? null
  const logo = dark ?? brand?.logoUrl ?? null
  const width = Math.min(Math.max(brand?.logoWidth ?? 160, 100), 220)
  return (
    <Section style={{ padding: '44px 24px 40px', textAlign: 'center' }}>
      {logo ? (
        <Img
          src={logo}
          alt={storeName}
          width={width}
          style={{ margin: '0 auto', height: 'auto' }}
        />
      ) : (
        <Text
          style={text({
            fontSize: '26px',
            letterSpacing: '6px',
            textTransform: 'uppercase',
            color: '#ffffff',
          })}
        >
          {storeName}
        </Text>
      )}
    </Section>
  )
}

/** The grey footer at the bottom of the card: links, when it is sent, what the figures count. */
function Footer({
  storeName,
  report: r,
  words,
}: {
  storeName: string
  report: PerformanceReport
  words: ReportWords
}) {
  const dot = <span style={{ color: C.muted }}> · </span>
  return (
    <Section
      className="r-pad"
      style={{ backgroundColor: C.footer, padding: '28px 40px 30px', textAlign: 'center' }}
    >
      <Text
        style={text({ fontSize: '13px', fontWeight: 700, color: C.ink, paddingBottom: '10px' })}
      >
        {storeName}
        {dot}
        <Link href={r.analyticsUrl} style={{ color: C.ink }}>
          {words.analytics}
        </Link>
        {dot}
        <Link href={r.settingsUrl} style={{ color: C.ink }}>
          {words.settings}
        </Link>
      </Text>
      <Text style={text({ fontSize: '13px', lineHeight: '19px', color: C.body })}>
        {r.footer}
        <br />
        {words.figuresNote}
      </Text>
    </Section>
  )
}

export function PerformanceReportEmail({
  storeName,
  brand,
  previewText,
  report: r,
  words,
}: PerformanceReportEmailProps) {
  // Black only when the store has a logo made for it (or none at all: the name is drawn in white).
  const bandColour = brand?.logoDarkUrl || !brand?.logoUrl ? C.band : C.lightBand
  const best = r.bars.find((b) => b.best)
  const todos = r.todos.length > 0 ? <Todos report={r} /> : null
  return (
    <Html>
      <Head>
        <style>{RESPONSIVE}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#ffffff',
          fontFamily: FONT,
          color: C.ink,
        }}
      >
        <Container style={{ maxWidth: '640px', width: '100%', margin: '0 auto' }}>
          <Section style={{ backgroundColor: bandColour }}>
            <Band storeName={storeName} brand={brand} />
            <Section className="r-band" style={{ padding: '0 32px' }}>
              <Section
                className="r-pad"
                style={{
                  backgroundColor: '#ffffff',
                  padding: '44px 40px 8px',
                  textAlign: 'center',
                }}
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
                <Text
                  className="r-title"
                  style={text({ fontSize: '42px', lineHeight: '46px', color: C.ink })}
                >
                  {r.title}
                </Text>
                <Text
                  style={text({
                    fontSize: '17px',
                    fontStyle: 'italic',
                    color: C.body,
                    paddingTop: '8px',
                  })}
                >
                  {r.periodLabel}
                </Text>
              </Section>
            </Section>
          </Section>
          {/* The card goes on below the band; the shadow shows where clients draw it. */}
          <Section className="r-band" style={{ padding: '0 32px 40px' }}>
            <Section style={{ backgroundColor: '#ffffff', boxShadow: CARD_SHADOW }}>
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
                    {words.netSales}
                  </Text>
                  <Text
                    className="r-net"
                    style={text({ fontSize: '60px', lineHeight: '66px', color: C.ink })}
                  >
                    {r.netLabel}
                  </Text>
                  <Text style={text({ fontSize: '13px', color: C.body, padding: '8px 0 22px' })}>
                    {r.change ? <ChangePill change={r.change} /> : null}
                    {r.changeNote}
                  </Text>
                  {r.bars.length > 0 && best ? <Bars bars={r.bars} /> : null}
                  {r.barNote ? (
                    <Text
                      style={text({
                        fontSize: '13px',
                        fontStyle: 'italic',
                        color: C.body,
                        paddingTop: '12px',
                      })}
                    >
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

              {r.todosFirst && todos ? <Block top={40}>{todos}</Block> : null}

              {r.sellers.length > 0 ? (
                <Block top={40}>
                  <Divider>{r.sellersTitle}</Divider>
                  <Sellers sellers={r.sellers} />
                </Block>
              ) : null}

              {r.sources.length > 0 ? (
                <Block>
                  <Divider>{words.sources}</Divider>
                  <Sources sources={r.sources} />
                </Block>
              ) : null}

              {!r.todosFirst && todos ? <Block top={24}>{todos}</Block> : null}

              <Block>
                <Divider>{r.moneyTitle}</Divider>
                <Money report={r} netTitle={words.netSales} />
              </Block>

              <Section style={{ padding: '44px 0 0' }}>
                <Footer storeName={storeName} report={r} words={words} />
              </Section>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
