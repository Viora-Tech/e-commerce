import { Column, Img, Row, Section, Text } from '@react-email/components'
import type { CSSProperties } from 'react'
import type { TemplateData } from '../types'
import { DividerLabel } from './components'
import { theme } from './theme'

type Colours = { bg: string; fg: string }

type Line = TemplateData['lines'][number]
export type TaxLine = { label: string; amount: string }

/** "Mouse / Blue · Ultimate" → name and variant on their own lines. */
function splitTitle(title: string): { name: string; variant: string | null } {
  const i = title.indexOf(' / ')
  return i === -1 ? { name: title, variant: null } : { name: title.slice(0, i), variant: title.slice(i + 3) }
}

const ROW_TEXT: CSSProperties = { margin: '0 0 7px', fontSize: '15px', lineHeight: '20px', color: theme.body }

/** One label / amount row of the totals. */
function MoneyRow({ row, style = ROW_TEXT }: { row: TaxLine; style?: CSSProperties }) {
  return (
    <Row>
      <Column>
        <Text style={style}>{row.label}</Text>
      </Column>
      <Column style={{ textAlign: 'right' }}>
        <Text style={style}>{row.amount}</Text>
      </Column>
    </Row>
  )
}

/**
 * The order list (Figma "Your order"): a photo in a square box, the name in bold with the variant
 * and quantity under it, the price on the right; then subtotal, discount, shipping, a ruled total
 * and the GST inside it.
 */
export function ItemsPanel({
  title,
  lines,
  totalHeading,
  totalLabel,
  subtotal,
  discount,
  shipping,
  taxBreakdown,
  afterTotal,
  qty,
}: {
  title: string
  lines: Line[]
  /** Kept for callers that still pass the store colours. */
  colours?: Colours | undefined
  totalHeading: string
  totalLabel?: string | undefined
  /** "Subtotal ₹7,798": shown when a discount or shipping sits between it and the total. */
  subtotal?: TaxLine | undefined
  discount?: TaxLine | undefined
  shipping?: TaxLine | undefined
  taxBreakdown?: TaxLine[] | undefined
  /** Rows under the total, e.g. "Store credit −₹500.00" then "To pay ₹1,000.00". */
  afterTotal?: TaxLine[] | undefined
  qty: (n: number) => string
}) {
  if (lines.length === 0) return null
  return (
    <>
      <DividerLabel>{title}</DividerLabel>
      <Section className="k-pad" style={{ padding: '12px 48px 0' }}>
        {lines.map((line, i) => {
          const { name, variant } = splitTitle(line.title)
          return (
            <Row
              key={`${line.title}-${line.quantity}-${line.priceLabel}`}
              style={{ borderTop: i === 0 ? 'none' : `1px solid ${theme.hairline}` }}
            >
              <Column style={{ width: '94px', padding: '12px 0', verticalAlign: 'top' }}>
                <div
                  style={{
                    width: '74px',
                    height: '74px',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {line.imageUrl ? (
                    <Img
                      src={line.imageUrl}
                      width="66"
                      height="66"
                      alt={name}
                      style={{ margin: '4px auto', objectFit: 'contain' }}
                    />
                  ) : null}
                </div>
              </Column>
              <Column style={{ padding: '16px 8px 12px 0', verticalAlign: 'top' }}>
                <Text
                  style={{ margin: 0, fontSize: '15px', lineHeight: '20px', fontWeight: 700, color: theme.ink }}
                >
                  {name}
                </Text>
                {variant ? (
                  <Text style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: '18px', color: theme.body }}>
                    {variant}
                  </Text>
                ) : null}
                <Text
                  style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: '18px', fontStyle: 'italic', color: theme.muted }}
                >
                  {qty(line.quantity)}
                </Text>
                {line.note ? (
                  <Text
                    style={{ margin: '6px 0 0', fontSize: '12.5px', lineHeight: '18px', color: theme.muted, whiteSpace: 'pre-line' }}
                  >
                    {line.note}
                  </Text>
                ) : null}
              </Column>
              <Column style={{ width: '110px', padding: '16px 0 12px', verticalAlign: 'top', textAlign: 'right' }}>
                <Text style={{ margin: 0, fontSize: '15px', lineHeight: '20px', color: theme.ink }}>
                  {line.priceLabel}
                </Text>
              </Column>
            </Row>
          )
        })}
        {totalLabel ? (
          <Section style={{ paddingTop: '16px' }}>
            {subtotal ? <MoneyRow row={subtotal} /> : null}
            {discount ? <MoneyRow row={discount} /> : null}
            {shipping ? <MoneyRow row={shipping} /> : null}
            <Section style={{ borderTop: `1px solid ${theme.ink}`, marginTop: '8px', paddingTop: '18px' }}>
              <MoneyRow
                row={{ label: totalHeading, amount: totalLabel }}
                style={{ margin: 0, fontSize: '22px', lineHeight: '28px', color: theme.ink }}
              />
              {taxBreakdown?.length ? (
                <Text
                  style={{ margin: '6px 0 0', fontSize: '12.5px', fontStyle: 'italic', color: theme.muted }}
                >
                  Includes GST: {taxBreakdown.map((t) => `${t.label} ${t.amount}`).join(' · ')}
                </Text>
              ) : null}
              {(afterTotal ?? []).map((row, i, rows) => (
                <MoneyRow
                  key={row.label}
                  row={row}
                  style={{
                    margin: i === 0 ? '12px 0 0' : '6px 0 0',
                    fontSize: i === rows.length - 1 ? '17px' : '14px',
                    lineHeight: '20px',
                    color: i === rows.length - 1 ? theme.ink : theme.body,
                  }}
                />
              ))}
            </Section>
          </Section>
        ) : null}
      </Section>
    </>
  )
}
