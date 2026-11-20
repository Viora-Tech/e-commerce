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
import { EmailFooter } from './footer'
import { theme, whatsappLink } from './theme'

type EmailLayoutProps = {
  previewText: string
  storeName: string
  storeAddress?: string | undefined
  brand?: EmailBrandInfo | undefined
  /** Present only on marketing sends; renders an unsubscribe line in the footer. */
  unsubscribeUrl?: string | undefined
  footerNote: string
  /** Team alerts and platform mail: no menu row, no help box, no socials. */
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
  /** ", or WhatsApp +91 …" after the help line, when the store has a support number. */
  helpWhatsapp: (phone: string) => string
  whatsapp: string
  whatsappUs: string
  poweredBy: string
  unsubscribe: string
}

/** Phones narrow the side padding and the heading; clients that ignore <style> keep the desktop look. */
const RESPONSIVE = `
@media only screen and (max-width: 560px) {
  .k-pad { padding-left: 22px !important; padding-right: 22px !important; }
  .k-title { font-size: 31px !important; line-height: 36px !important; }
  .k-stack { display: block !important; width: 100% !important; }
}`

/**
 * The one shell every email renders inside (Figma "Emails · Batch 1"): a white card on cream,
 * the store's logo with Shop · Track order · Contact under it, the message, the "Questions?" box
 * and the footer with the socials, why they got the email and the store's address.
 */
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
  const shop = brand?.shopUrl ?? null
  const logo = brand?.logoUrl ?? null
  const logoWidth = Math.min(Math.max(brand?.logoWidth ?? 150, 60), 220)
  const menu = shop
    ? [
        { label: labels.shop, url: shop },
        { label: labels.track, url: `${shop}/track-order` },
        { label: labels.contact, url: `${shop}/pages/contact` },
      ]
    : []
  const wa = whatsappLink(brand?.supportPhone)

  return (
    <Html>
      <Head>
        <style>{RESPONSIVE}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: theme.panel,
          margin: 0,
          padding: '32px 12px',
          fontFamily: theme.fontFamily,
          color: theme.ink,
        }}
      >
        <Container
          style={{
            maxWidth: '620px',
            width: '100%',
            tableLayout: 'fixed',
            margin: '0 auto',
            backgroundColor: theme.page,
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <Section className="k-pad" style={{ padding: '40px 48px 0', textAlign: 'center' }}>
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
                  fontSize: '22px',
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: theme.ink,
                }}
              >
                {storeName}
              </Text>
            )}
            <Text
              style={{
                margin: 0,
                padding: '18px 0 18px',
                borderBottom: `1px solid ${theme.border}`,
                fontSize: '14px',
                lineHeight: '18px',
              }}
            >
              {!internal
                ? menu.map((m) => (
                    <Link
                      key={m.url}
                      href={m.url}
                      style={{ color: theme.body, textDecoration: 'none', margin: '0 12px' }}
                    >
                      {m.label}
                    </Link>
                  ))
                : null}
            </Text>
          </Section>

          {children}

          {!internal ? (
            <Section className="k-pad" style={{ padding: '36px 48px 0' }}>
              <Row
                style={{
                  backgroundColor: theme.soft,
                  borderRadius: '8px',
                }}
              >
                <Column className="k-stack" style={{ padding: '18px 0 18px 22px' }}>
                  <Text style={{ margin: 0, fontSize: '16px', lineHeight: '22px', color: theme.ink }}>
                    {labels.helpTitle}
                  </Text>
                  <Text
                    style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: '18px', color: theme.body }}
                  >
                    {labels.helpBody}
                    {brand?.supportPhone ? labels.helpWhatsapp(brand.supportPhone) : ''}
                  </Text>
                </Column>
                {wa ? (
                  <Column
                    className="k-stack"
                    style={{ width: '140px', padding: '18px 22px', textAlign: 'right' }}
                  >
                    <Link
                      href={wa}
                      style={{
                        display: 'inline-block',
                        padding: '7px 14px',
                        border: `1px solid ${theme.ink}`,
                        borderRadius: '4px',
                        backgroundColor: theme.page,
                        fontSize: '13px',
                        fontWeight: 700,
                        color: theme.ink,
                        textDecoration: 'none',
                      }}
                    >
                      {labels.whatsappUs}
                    </Link>
                  </Column>
                ) : null}
              </Row>
            </Section>
          ) : null}

          <EmailFooter
            brand={brand}
            storeAddress={storeAddress}
            footerNote={footerNote}
            unsubscribeUrl={unsubscribeUrl}
            internal={internal}
            labels={labels}
          />
        </Container>
      </Body>
    </Html>
  )
}
