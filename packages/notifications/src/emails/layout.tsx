import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'
import { theme } from './theme'

type EmailLayoutProps = {
  previewText: string
  storeName: string
  storeAddress?: string | undefined
  /** Present only on marketing sends; renders an unsubscribe line in the footer. */
  unsubscribeUrl?: string | undefined
  footerNote: string
  children: ReactNode
}

/** One shared shell every transactional and marketing email renders inside. */
export function EmailLayout({
  previewText,
  storeName,
  storeAddress,
  unsubscribeUrl,
  footerNote,
  children,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: theme.bg,
          margin: 0,
          padding: '24px 0',
          fontFamily: theme.fontFamily,
        }}
      >
        <Container
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            padding: '0 16px',
          }}
        >
          <Section style={{ padding: '8px 4px 20px' }}>
            <Text
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: theme.ink,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {storeName}
            </Text>
          </Section>
          <Section
            style={{
              backgroundColor: theme.card,
              borderRadius: theme.radius,
              padding: '32px',
              border: `1px solid ${theme.border}`,
            }}
          >
            {children}
          </Section>
          <Section style={{ padding: '20px 4px 0' }}>
            <Text style={{ fontSize: '12px', color: theme.muted, margin: '0 0 4px' }}>
              {footerNote}
            </Text>
            {storeAddress ? (
              <Text style={{ fontSize: '12px', color: theme.muted, margin: '0 0 4px' }}>
                {storeAddress}
              </Text>
            ) : null}
            {unsubscribeUrl ? (
              <Text style={{ fontSize: '12px', color: theme.muted, margin: 0 }}>
                <a href={unsubscribeUrl} style={{ color: theme.muted }}>
                  Unsubscribe
                </a>
              </Text>
            ) : null}
          </Section>
          <Hr style={{ display: 'none' }} />
        </Container>
      </Body>
    </Html>
  )
}
