import { Section, Text } from '@react-email/components'
import { theme } from '../theme'

/**
 * An order that goes out in several parcels (Figma "Order split into parcels"): one ruled card,
 * each parcel with its heading, when it comes and what is in it. Also used by Order placed when
 * the order leaves from more than one warehouse.
 */
export type ParcelsBlock = {
  kind: 'parcels'
  title?: string | undefined
  note?: string | undefined
  parcels: { heading: string; when?: string | null | undefined; items: string[] }[]
}

export function Parcels({ block: b, accent }: { block: ParcelsBlock; accent: string }) {
  return (
    <Section style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '4px 22px' }}>
      {b.title ? (
        <Section style={{ padding: '14px 0 2px' }}>
          <Text style={{ margin: 0, fontSize: '16px', lineHeight: '22px', color: theme.ink }}>{b.title}</Text>
          {b.note ? (
            <Text style={{ margin: '2px 0 0', fontSize: '12.5px', lineHeight: '18px', fontStyle: 'italic', color: theme.muted }}>
              {b.note}
            </Text>
          ) : null}
        </Section>
      ) : null}
      {b.parcels.map((p, i) => (
        <Section
          key={p.heading}
          style={{ padding: '14px 0', borderTop: i === 0 && !b.title ? 'none' : `1px solid ${theme.hairline}` }}
        >
          <Text style={{ margin: 0, fontSize: '15px', lineHeight: '20px', fontWeight: 700, color: theme.ink }}>
            {p.heading}
          </Text>
          {p.when ? (
            <Text style={{ margin: '2px 0 0', fontSize: '13px', lineHeight: '18px', fontStyle: 'italic', color: accent }}>
              {p.when}
            </Text>
          ) : null}
          {p.items.map((item) => (
            <Text key={item} style={{ margin: '4px 0 0', fontSize: '14px', lineHeight: '20px', color: theme.body }}>
              {item}
            </Text>
          ))}
        </Section>
      ))}
    </Section>
  )
}
