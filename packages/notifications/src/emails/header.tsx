import { Img, Link, Section, Text } from '@react-email/components'
import type { EmailBrandInfo } from '../types'
import type { LayoutLabels } from './layout'
import { theme } from './theme'

type EmailHeaderProps = {
  storeName: string
  brand?: EmailBrandInfo | undefined
  /** The Shop · Track order · Contact row under the logo; off for team alerts. */
  menu: boolean
  labels: LayoutLabels
}

/** The top of the card: the store's logo (or its name in caps) and the menu row under it. */
export function EmailHeader({ storeName, brand, menu, labels }: EmailHeaderProps) {
  const shop = brand?.shopUrl ?? null
  const logo = brand?.logoUrl ?? null
  const logoWidth = Math.min(Math.max(brand?.logoWidth ?? 150, 60), 220)
  const links = shop
    ? [
        { label: labels.shop, url: shop },
        { label: labels.track, url: `${shop}/track-order` },
        { label: labels.contact, url: `${shop}/pages/contact` },
      ]
    : []
  return (
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
        {menu
          ? links.map((m) => (
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
  )
}
