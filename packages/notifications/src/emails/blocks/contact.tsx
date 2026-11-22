import { Img, Link, Section, Text } from '@react-email/components'
import { theme } from '../theme'

/** WhatsApp's own green, for its logo and the button's outline. */
const WHATSAPP_GREEN = '#25d366'

/**
 * "WhatsApp us": the store's WhatsApp logo and a label in a green-outlined pill, linking to its
 * wa.me chat; `note` a short line above it. The logo is a hosted PNG (`/email/whatsapp-green.png`
 * on the store's site, since inboxes drop SVG); without one (a preview of platform mail) the pill
 * shows the label alone. Leave the block out when the store has no number.
 */
export type WhatsappBlock = {
  kind: 'whatsapp'
  label: string
  url: string
  logoSrc?: string | null | undefined
  note?: string | undefined
}

export function Whatsapp({ block: b }: { block: WhatsappBlock }) {
  return (
    <Section style={{ textAlign: 'center' }}>
      {b.note ? (
        <Text
          style={{ margin: '0 0 10px', fontSize: '14px', lineHeight: '20px', color: theme.body }}
        >
          {b.note}
        </Text>
      ) : null}
      <Link
        href={b.url}
        style={{
          display: 'inline-block',
          padding: '9px 18px',
          border: `1.5px solid ${WHATSAPP_GREEN}`,
          borderRadius: '999px',
          backgroundColor: theme.page,
          fontSize: '15px',
          lineHeight: '22px',
          fontWeight: 700,
          color: theme.ink,
          textDecoration: 'none',
        }}
      >
        {b.logoSrc ? (
          <Img
            src={b.logoSrc}
            width="22"
            height="22"
            alt="WhatsApp"
            style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              margin: '0 8px 0 0',
              border: 0,
            }}
          />
        ) : null}
        <span style={{ verticalAlign: 'middle' }}>{b.label}</span>
      </Link>
    </Section>
  )
}
