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
import type { ReactNode } from 'react'
import type { EmailBrandInfo } from '../types'
import { brandColours, theme } from './theme'

type EmailLayoutProps = {
  previewText: string
  storeName: string
  storeAddress?: string | undefined
  brand?: EmailBrandInfo | undefined
  /** Present only on marketing sends; renders an unsubscribe line in the footer. */
  unsubscribeUrl?: string | undefined
  footerNote: string
  /** Team alerts and platform mail: no menu row, no help block. */
  internal?: boolean | undefined
  labels: LayoutLabels
  children: ReactNode
}

export type LayoutLabels = {
  shop: string
  track: string
  contact: string
  helpTitle: string
  helpBody: string
  whatsapp: string
  poweredBy: string
  unsubscribe: string
}

const SOCIAL_SHORT: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  youtube: 'YT',
  x: 'X',
  twitter: 'X',
  linkedin: 'IN',
  pinterest: 'PI',
  tiktok: 'TT',
  whatsapp: 'WA',
  threads: 'TH',
}

/** Phones stack the hero's two columns; clients that ignore <style> keep them side by side. */
const RESPONSIVE = `
@media only screen and (max-width: 560px) {
  .k-stack { display: block !important; width: 100% !important; }
  .k-pad { padding-left: 22px !important; padding-right: 22px !important; }
  .k-hero-title { font-size: 30px !important; line-height: 32px !important; }
}`

/** The one shell every email renders inside: header, the message, help, and the dark footer. */
export function EmailLayout({
  previewText,
  storeName,
  storeAddress,
  brand,
  unsubscribeUrl,
  footerNote,
  internal,
  labels,
  children,
}: EmailLayoutProps) {
  const { bg } = brandColours(brand)
  const shop = brand?.shopUrl ?? null
  const logo = brand?.logoUrl ?? null
  const logoWidth = Math.min(Math.max(brand?.logoWidth ?? 140, 60), 220)
  const address = brand?.address ?? storeAddress
  const social = (brand?.social ?? []).filter((s) => /^https?:\/\//i.test(s.url)).slice(0, 6)
  const menu = shop
    ? [
        { label: labels.shop, url: shop },
        { label: labels.track, url: `${shop}/track-order` },
        { label: labels.contact, url: `${shop}/pages/contact` },
      ]
    : []
  const support = [
    brand?.supportEmail
      ? { label: brand.supportEmail, url: `mailto:${brand.supportEmail}` }
      : undefined,
    brand?.supportPhone
      ? {
          label: `${labels.whatsapp} ${brand.supportPhone}`,
          url: `https://wa.me/${brand.supportPhone.replace(/\D/g, '')}`,
        }
      : undefined,
  ].filter((s): s is { label: string; url: string } => Boolean(s))

  return (
    <Html>
      <Head>
        {/* Apple Mail and iOS load it; Gmail and Outlook fall back to the system stack. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
        <style>{RESPONSIVE}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: theme.panel,
          margin: 0,
          padding: '24px 0',
          fontFamily: theme.fontFamily,
          color: theme.ink,
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            width: '100%',
            tableLayout: 'fixed',
            margin: '0 auto',
            backgroundColor: theme.page,
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          <Section style={{ padding: '30px 24px 0', textAlign: 'center' }}>
            {logo ? (
              <Link href={shop ?? undefined}>
                <Img
                  src={logo}
                  alt={storeName}
                  width={logoWidth}
                  style={{ margin: '0 auto', maxWidth: '100%', height: 'auto' }}
                />
              </Link>
            ) : (
              <Text
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: theme.ink,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '18px',
                    height: '18px',
                    borderRadius: '6px',
                    backgroundColor: bg,
                    marginRight: '10px',
                    verticalAlign: '-2px',
                  }}
                />
                {storeName}
              </Text>
            )}
          </Section>
          {!internal && menu.length > 0 ? (
            <Section style={{ padding: '14px 24px 0' }}>
              <Text
                style={{
                  margin: 0,
                  paddingBottom: '18px',
                  borderBottom: `1px solid ${theme.border}`,
                  textAlign: 'center',
                  fontSize: '13px',
                }}
              >
                {menu.map((m, i) => (
                  <span key={m.url}>
                    {i > 0 ? (
                      <span style={{ color: theme.faint, padding: '0 10px' }}>·</span>
                    ) : null}
                    <Link href={m.url} style={{ color: theme.body, textDecoration: 'none' }}>
                      {m.label}
                    </Link>
                  </span>
                ))}
              </Text>
            </Section>
          ) : null}

          {children}

          {!internal && support.length > 0 ? (
            <Section style={{ padding: '28px 24px 0' }}>
              <Section
                style={{
                  backgroundColor: bg,
                  borderRadius: '20px',
                  padding: '28px 24px',
                  textAlign: 'center',
                }}
              >
                <Text
                  style={{
                    margin: '0 0 6px',
                    fontSize: '21px',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: brandColours(brand).fg,
                  }}
                >
                  {labels.helpTitle}
                </Text>
                <Text
                  style={{
                    margin: '0 0 16px',
                    fontSize: '14px',
                    lineHeight: '21px',
                    color: brandColours(brand).fg,
                    opacity: 0.88,
                  }}
                >
                  {labels.helpBody}
                </Text>
                <Text style={{ margin: 0 }}>
                  {support.map((s) => (
                    <Link
                      key={s.url}
                      href={s.url}
                      style={{
                        display: 'inline-block',
                        margin: '4px',
                        padding: '10px 16px',
                        border: `1.5px solid ${brandColours(brand).fg}`,
                        borderRadius: '10px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        color: brandColours(brand).fg,
                        textDecoration: 'none',
                      }}
                    >
                      {s.label}
                    </Link>
                  ))}
                </Text>
              </Section>
            </Section>
          ) : null}

          <Section
            style={{
              marginTop: '30px',
              backgroundColor: theme.footer,
              padding: '32px 24px 30px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                margin: '0 0 14px',
                fontSize: '16px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#ffffff',
              }}
            >
              {storeName}
            </Text>
            {social.length > 0 ? (
              <Row style={{ width: 'auto', margin: '0 auto 16px' }}>
                {social.map((s) => (
                  <Column key={s.url} style={{ padding: '0 4px' }}>
                    <Link
                      href={s.url}
                      style={{
                        display: 'inline-block',
                        width: '34px',
                        height: '34px',
                        lineHeight: '34px',
                        borderRadius: '17px',
                        backgroundColor: '#2a2a27',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      {SOCIAL_SHORT[s.platform] ?? s.platform.slice(0, 2).toUpperCase()}
                    </Link>
                  </Column>
                ))}
              </Row>
            ) : null}
            {!internal && menu.length > 0 ? (
              <Text style={{ margin: '0 0 14px', fontSize: '12.5px' }}>
                {menu.map((m) => (
                  <Link
                    key={m.url}
                    href={m.url}
                    style={{ color: '#e6e4de', textDecoration: 'none', margin: '0 9px' }}
                  >
                    {m.label}
                  </Link>
                ))}
              </Text>
            ) : null}
            <Text
              style={{
                margin: '0 0 4px',
                fontSize: '12px',
                lineHeight: '19px',
                color: theme.footerText,
              }}
            >
              {footerNote}
            </Text>
            {address ? (
              <Text
                style={{
                  margin: '0 0 4px',
                  fontSize: '11.5px',
                  lineHeight: '18px',
                  color: '#85827a',
                }}
              >
                {address}
              </Text>
            ) : null}
            {unsubscribeUrl ? (
              <Text style={{ margin: '0 0 4px', fontSize: '11.5px' }}>
                <Link href={unsubscribeUrl} style={{ color: theme.footerText }}>
                  {labels.unsubscribe}
                </Link>
              </Text>
            ) : null}
            <Text style={{ margin: '8px 0 0', fontSize: '11px', color: '#77746c' }}>
              {labels.poweredBy}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
