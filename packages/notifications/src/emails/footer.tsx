import { Column, Img, Link, Row, Section, Text } from '@react-email/components'
import type { EmailBrandInfo } from '../types'
import type { LayoutLabels } from './layout'
import { emailAsset, theme, whatsappLink } from './theme'

type EmailFooterProps = {
  brand?: EmailBrandInfo | undefined
  storeAddress?: string | undefined
  footerNote: string
  unsubscribeUrl?: string | undefined
  internal?: boolean | undefined
  /** Draw the socials row; defaults to every customer email (not team alerts). */
  showSocial?: boolean | undefined
  labels: LayoutLabels
  /** A saved design's own footer links, one row under the note (Edit design). */
  links?: { label: string; url: string }[] | undefined
  /** False hides the store's address. */
  showAddress?: boolean | undefined
  background?: string | undefined
}

/** Socials drawn as the Figma icons; any other platform gets a lettered circle. */
const ICONS: Record<string, string> = {
  instagram: 'instagram',
  youtube: 'youtube',
  whatsapp: 'whatsapp',
  x: 'x',
  twitter: 'x',
}

/** The order the icons sit in, as in the Figma footer; unknown platforms go last. */
const ORDER = ['instagram', 'youtube', 'whatsapp', 'x', 'twitter']

/**
 * The store's socials for the footer: its own links, plus WhatsApp from the support number when
 * it has not listed WhatsApp itself. At most six, http(s) links only.
 */
export function socialLinks(
  brand: EmailBrandInfo | undefined,
): { platform: string; url: string }[] {
  const listed = (brand?.social ?? []).filter((s) => /^https?:\/\//i.test(s.url))
  const wa = whatsappLink(brand?.supportPhone)
  const all =
    wa && !listed.some((s) => s.platform === 'whatsapp')
      ? [...listed, { platform: 'whatsapp', url: wa }]
      : listed
  const rank = (p: string) => {
    const i = ORDER.indexOf(p)
    return i === -1 ? ORDER.length : i
  }
  return [...all].sort((a, b) => rank(a.platform) - rank(b.platform)).slice(0, 6)
}

/** The grey band at the bottom of the card: socials, why they got it, the address. */
export function EmailFooter({
  brand,
  storeAddress,
  footerNote,
  unsubscribeUrl,
  internal,
  showSocial = !internal,
  labels,
  links,
  showAddress = true,
  background,
}: EmailFooterProps) {
  const social = showSocial ? socialLinks(brand) : []
  const address = showAddress ? (brand?.address ?? storeAddress) : undefined
  return (
    <Section
      className="k-pad"
      style={{
        marginTop: '36px',
        backgroundColor: background ?? theme.soft,
        borderTop: `1px solid ${theme.hairline}`,
        padding: '28px 48px 30px',
        textAlign: 'center',
      }}
    >
      {social.length > 0 ? <SocialRow brand={brand} links={social} /> : null}
      <Text style={{ margin: '0 0 6px', fontSize: '13px', lineHeight: '19px', color: theme.body }}>
        {footerNote}
      </Text>
      {links && links.length > 0 ? (
        <Text style={{ margin: '0 0 6px', fontSize: '13px', lineHeight: '19px' }}>
          {links.map((l, i) => (
            <span key={l.url}>
              {i > 0 ? <span style={{ color: theme.faint }}>&nbsp;&nbsp;·&nbsp;&nbsp;</span> : null}
              <Link href={l.url} style={{ color: theme.body, textDecoration: 'underline' }}>
                {l.label}
              </Link>
            </span>
          ))}
        </Text>
      ) : null}
      {address ? (
        <Text
          style={{ margin: '0 0 4px', fontSize: '12px', lineHeight: '18px', color: theme.muted }}
        >
          {address}
        </Text>
      ) : null}
      {unsubscribeUrl ? (
        <Text style={{ margin: '0 0 4px', fontSize: '12px' }}>
          <Link href={unsubscribeUrl} style={{ color: theme.muted }}>
            {labels.unsubscribe}
          </Link>
        </Text>
      ) : null}
    </Section>
  )
}

/** The store's social icons in one centred row (footer, or a Social block in a saved design). */
export function SocialRow({
  brand,
  links = socialLinks(brand),
}: {
  brand?: EmailBrandInfo | undefined
  links?: { platform: string; url: string }[] | undefined
}) {
  if (links.length === 0) return null
  return (
    <Row style={{ width: 'auto', margin: '0 auto 16px' }}>
      {links.map((s) => {
        const icon = ICONS[s.platform]
        const src = icon ? emailAsset(brand?.shopUrl, icon) : null
        return (
          <Column key={s.url} style={{ padding: '0 4px' }}>
            <Link href={s.url} style={{ textDecoration: 'none' }}>
              {src ? (
                <Img
                  src={src}
                  width="34"
                  height="34"
                  alt={s.platform}
                  style={{ display: 'block' }}
                />
              ) : (
                <span
                  style={{
                    display: 'inline-block',
                    width: '34px',
                    height: '34px',
                    lineHeight: '34px',
                    borderRadius: '17px',
                    backgroundColor: theme.ink,
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  {s.platform.slice(0, 2).toUpperCase()}
                </span>
              )}
            </Link>
          </Column>
        )
      })}
    </Row>
  )
}
