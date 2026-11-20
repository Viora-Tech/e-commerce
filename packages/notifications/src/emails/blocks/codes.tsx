import { Button, Column, Row, Section, Text } from '@react-email/components'
import { theme } from '../theme'
import { CAPS } from './tokens'

/**
 * A one-time code (sign-in, account deletion, email change): the digits large and unbroken, a
 * Copy code button and when it expires. Email clients run no scripts, so the button opens a
 * small page that copies the code in one tap; the code rides in the link's #fragment, which
 * never reaches the server or its logs.
 */
export type CodeBlock = {
  kind: 'code'
  code: string
  expires?: string | undefined
  /** The copy page, or none (a preview, a platform email without a shop). */
  copy?: { label: string; url: string } | undefined
}

/** A discount or gift card code in a dashed card, with what it is worth on the right. */
export type CouponBlock = {
  kind: 'coupon'
  label: string
  code: string
  note?: string | undefined
  /** "10%", "₹2,000". */
  value?: string | undefined
  /** "OFF", "GIFT CARD". */
  valueNote?: string | undefined
}

export function Code({ block: b, accent }: { block: CodeBlock; accent: string }) {
  return (
    <Section
      style={{
        backgroundColor: '#f5f1fe',
        border: '1px dashed #d8ccfb',
        borderRadius: '8px',
        padding: '26px 20px 22px',
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: '44px',
          lineHeight: '52px',
          fontWeight: 700,
          letterSpacing: '14px',
          color: theme.ink,
        }}
      >
        {b.code}
      </Text>
      {b.copy ? (
        <Button
          href={b.copy.url}
          style={{
            marginTop: '14px',
            backgroundColor: accent,
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 700,
            padding: '9px 20px',
            borderRadius: '999px',
            textDecoration: 'none',
          }}
        >
          {b.copy.label}
        </Button>
      ) : null}
      {b.expires ? (
        <Text style={{ margin: '10px 0 0', fontSize: '13px', fontStyle: 'italic', color: accent }}>{b.expires}</Text>
      ) : null}
    </Section>
  )
}

export function Coupon({ block: b, accent }: { block: CouponBlock; accent: string }) {
  return (
    <Section style={{ backgroundColor: '#f5f1fe', border: `2px dashed ${accent}`, borderRadius: '8px' }}>
      <Row>
        <Column style={{ padding: '18px 0 18px 20px', verticalAlign: 'middle' }}>
          <Text style={{ ...CAPS, color: accent }}>{b.label}</Text>
          <Text
            style={{ margin: '4px 0 0', fontSize: '24px', lineHeight: '30px', fontWeight: 700, letterSpacing: '3px', color: theme.ink }}
          >
            {b.code}
          </Text>
          {b.note ? (
            <Text style={{ margin: '4px 0 0', fontSize: '12.5px', fontStyle: 'italic', color: theme.body }}>{b.note}</Text>
          ) : null}
        </Column>
        {b.value ? (
          <Column style={{ width: '130px', padding: '18px 20px 18px 0', textAlign: 'right', verticalAlign: 'middle' }}>
            <Text style={{ margin: 0, fontSize: '32px', lineHeight: '36px', color: accent }}>{b.value}</Text>
            {b.valueNote ? <Text style={{ ...CAPS, color: accent }}>{b.valueNote}</Text> : null}
          </Column>
        ) : null}
      </Row>
    </Section>
  )
}
