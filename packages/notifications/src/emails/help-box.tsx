import { Column, Link, Row, Section, Text } from '@react-email/components'
import type { EmailBrandInfo } from '../types'
import type { LayoutLabels } from './layout'
import { theme, whatsappLink } from './theme'

/** The "Questions?" box near the end of a customer email, with WhatsApp when the store has a number. */
export function HelpBox({
  brand,
  labels,
}: {
  brand?: EmailBrandInfo | undefined
  labels: LayoutLabels
}) {
  const wa = whatsappLink(brand?.supportPhone)
  return (
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
  )
}
