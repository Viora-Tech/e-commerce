import { Column, Img, Link, Row, Text } from '@react-email/components'
import { theme } from '../theme'

/** A file sent with the email: "Invoice INV-2026-1042.pdf · 1 page" with Download. */
export type AttachmentBlock = {
  kind: 'attachment'
  name: string
  meta?: string | undefined
  /** "PDF". */
  badge: string
  link?: { label: string; url: string } | undefined
}

/** A row of product tiles: "Popular right now", "Goes well with". Three to a row, two on a phone. */
export type ProductsBlock = {
  kind: 'products'
  items: { title: string; priceLabel: string; url: string; imageUrl?: string | undefined }[]
}

export function Attachment({ block: b, accent }: { block: AttachmentBlock; accent: string }) {
  return (
    <Row style={{ border: `1px solid ${theme.border}`, borderRadius: '10px' }}>
      <Column style={{ width: '64px', padding: '14px 0 14px 16px', verticalAlign: 'middle' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            lineHeight: '40px',
            borderRadius: '6px',
            backgroundColor: theme.badBg,
            color: theme.bad,
            fontSize: '10px',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {b.badge}
        </div>
      </Column>
      <Column style={{ padding: '14px 8px', verticalAlign: 'middle' }}>
        <Text style={{ margin: 0, fontSize: '14px', lineHeight: '20px', fontWeight: 700, color: theme.ink }}>{b.name}</Text>
        {b.meta ? (
          <Text style={{ margin: 0, fontSize: '12px', fontStyle: 'italic', color: theme.muted }}>{b.meta}</Text>
        ) : null}
      </Column>
      {b.link ? (
        <Column style={{ width: '110px', padding: '14px 16px 14px 0', textAlign: 'right', verticalAlign: 'middle' }}>
          <Link href={b.link.url} style={{ fontSize: '13px', fontWeight: 700, color: accent, textDecoration: 'none' }}>
            {b.link.label} →
          </Link>
        </Column>
      ) : null}
    </Row>
  )
}

export function Products({ block: b }: { block: ProductsBlock }) {
  const items = b.items.slice(0, 3)
  return (
    <Row>
      {items.map((p, i) => (
        <Column
          key={p.url}
          style={{
            width: `${100 / items.length}%`,
            padding: i === 0 ? '0 6px 0 0' : i === items.length - 1 ? '0 0 0 6px' : '0 3px',
            verticalAlign: 'top',
          }}
        >
          <Link href={p.url} style={{ textDecoration: 'none' }}>
            <div
              style={{
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                textAlign: 'center',
                padding: '8px',
              }}
            >
              {p.imageUrl ? (
                <Img src={p.imageUrl} width="140" alt={p.title} style={{ margin: '0 auto', maxWidth: '100%', height: 'auto' }} />
              ) : null}
            </div>
            <Text style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: '18px', fontWeight: 700, color: theme.ink }}>
              {p.title}
            </Text>
            <Text style={{ margin: '2px 0 0', fontSize: '12.5px', color: theme.body }}>{p.priceLabel}</Text>
          </Link>
        </Column>
      ))}
    </Row>
  )
}

/** One product on its own: the back-in-stock item, the product a question is about. */
export type ProductBlock = {
  kind: 'product'
  title: string
  /** "Ocean Blue · Hall effect  ·  ₹6,999". */
  note?: string | undefined
  imageUrl?: string | undefined
  url?: string | undefined
  /** A small line above the name: "In stock · 12 left". */
  badge?: string | undefined
}

export function Product({ block: b, accent }: { block: ProductBlock; accent: string }) {
  const name = (
    <Text style={{ margin: 0, fontSize: '17px', lineHeight: '23px', color: theme.ink }}>{b.title}</Text>
  )
  return (
    <Row style={{ border: `1px solid ${theme.border}`, borderRadius: '10px' }}>
      {b.imageUrl ? (
        <Column style={{ width: '96px', padding: '14px 0 14px 16px', verticalAlign: 'middle' }}>
          <Img src={b.imageUrl} width="76" height="76" alt={b.title} style={{ display: 'block', borderRadius: '6px' }} />
        </Column>
      ) : null}
      <Column style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
        {b.badge ? (
          <Text style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: theme.good }}>{b.badge}</Text>
        ) : null}
        {b.url ? (
          <Link href={b.url} style={{ textDecoration: 'none', color: theme.ink }}>
            {name}
          </Link>
        ) : (
          name
        )}
        {b.note ? (
          <Text style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: '18px', fontStyle: 'italic', color: accent }}>
            {b.note}
          </Text>
        ) : null}
      </Column>
    </Row>
  )
}
