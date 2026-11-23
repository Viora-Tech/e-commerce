import { Body, Container, Head, Html, Preview } from '@react-email/components'
import type { ReactNode } from 'react'
import type { EmailBrandInfo } from '../types'
import { EmailFooter } from './footer'
import { EmailHeader } from './header'
import { HelpBox } from './help-box'
import { theme } from './theme'

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
  /**
   * A merchant's saved design draws its own header, help box and footer as blocks
   * (`design/`), so the shell keeps only the card.
   */
  bare?: boolean | undefined
  /** A saved design's page colour, card colour and card width (px). */
  look?:
    | { background?: string | undefined; card?: string | undefined; width?: number | undefined }
    | undefined
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
  bare,
  look,
  children,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <style>{RESPONSIVE}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: look?.background ?? theme.panel,
          margin: 0,
          padding: '32px 12px',
          fontFamily: theme.fontFamily,
          color: theme.ink,
        }}
      >
        <Container
          style={{
            maxWidth: `${look?.width ?? 620}px`,
            width: '100%',
            tableLayout: 'fixed',
            margin: '0 auto',
            backgroundColor: look?.card ?? theme.page,
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          {bare ? null : (
            <EmailHeader storeName={storeName} brand={brand} menu={!internal} labels={labels} />
          )}

          {children}

          {!internal && !bare ? <HelpBox brand={brand} labels={labels} /> : null}

          {bare ? null : (
            <EmailFooter
              brand={brand}
              storeAddress={storeAddress}
              footerNote={footerNote}
              unsubscribeUrl={unsubscribeUrl}
              internal={internal}
              labels={labels}
            />
          )}
        </Container>
      </Body>
    </Html>
  )
}
