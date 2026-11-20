import { Column, Img, Row, Section, Text } from '@react-email/components'
import { theme } from '../theme'
import { CAPS } from './tokens'

export type TicketBlock = {
  kind: 'ticket'
  labels: { from: string; to: string }
  from: string
  fromNote?: string | undefined
  to: string
  toNote?: string | undefined
  /** Under the vehicle: the courier service ("Delhivery Surface"), "4 km away", "Delivered". */
  via?: string | undefined
  /** Facts under the route, two to four: Order, Status, Expected; Courier, AWB, Arrives. */
  meta: { label: string; value: string }[]
  /** Under the perforation: one bold line and one quiet line. */
  foot?: { line: string; note?: string | undefined } | undefined
  /**
   * How far along the route is: `waiting` nothing moved yet (grey), `moving` on its way (the
   * first half in colour), `done` arrived (the whole line in colour).
   */
  progress: 'waiting' | 'moving' | 'done'
  /** The vehicle picture (truck, plane, box), or null for a plain circle. */
  vehicleSrc: string | null
}

/** One dashed run of the route line, as a table cell's top border. */
function Dash({ colour }: { colour: string }) {
  return (
    <td style={{ width: '50%', padding: 0, verticalAlign: 'middle' }}>
      <div style={{ borderTop: `2px dashed ${colour}`, fontSize: '1px', lineHeight: '1px' }}>&nbsp;</div>
    </td>
  )
}

/** A place on the ticket: caps label, the city, and who or what is there. */
function Place({ label, city, note }: { label: string; city: string; note?: string | undefined }) {
  return (
    <>
      <Text style={CAPS}>{label}</Text>
      <Text style={{ margin: '2px 0 0', fontSize: '21px', lineHeight: '26px', color: theme.ink }}>{city}</Text>
      {note ? (
        <Text style={{ margin: 0, fontSize: '12px', lineHeight: '17px', fontStyle: 'italic', color: theme.muted }}>
          {note}
        </Text>
      ) : null}
    </>
  )
}

/**
 * The route ticket (Figma "Order placed", "Order shipped", returns): where it leaves from and
 * where it goes, the vehicle between them, a row of facts, then a perforated foot. Every order,
 * delivery, return and exchange email uses it; only the words and `progress` change. Tables
 * only, so Gmail and Outlook draw it the same.
 */
export function Ticket({ block: b, accent }: { block: TicketBlock; accent: string }) {
  const first = b.progress === 'waiting' ? theme.border : accent
  const second = b.progress === 'done' ? accent : theme.border
  const circle = b.progress === 'waiting' ? theme.border : accent
  return (
    <Section style={{ border: `1px solid ${theme.border}`, borderRadius: '10px' }}>
      <Row>
        <Column style={{ padding: '22px 0 0 24px', verticalAlign: 'top', width: '28%' }}>
          <Place label={b.labels.from} city={b.from} note={b.fromNote} />
        </Column>
        <Column style={{ padding: '26px 8px 0', verticalAlign: 'top', textAlign: 'center' }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <Dash colour={first} />
                <td style={{ padding: '0 8px', width: '40px' }}>
                  {b.vehicleSrc ? (
                    <Img src={b.vehicleSrc} width="40" height="40" alt="" style={{ display: 'block' }} />
                  ) : (
                    <div
                      style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: circle }}
                    />
                  )}
                </td>
                <Dash colour={second} />
              </tr>
            </tbody>
          </table>
          {b.via ? (
            <Text
              style={{
                margin: '6px 0 0',
                fontSize: '11px',
                fontWeight: 700,
                color: b.progress === 'waiting' ? theme.muted : accent,
              }}
            >
              {b.via}
            </Text>
          ) : null}
        </Column>
        <Column style={{ padding: '22px 24px 0 0', verticalAlign: 'top', width: '28%', textAlign: 'right' }}>
          <Place label={b.labels.to} city={b.to} note={b.toNote} />
        </Column>
      </Row>
      <Row>
        {b.meta.map((m, i) => (
          <Column
            key={m.label}
            style={{
              padding: i === 0 ? '20px 8px 18px 24px' : '20px 8px 18px',
              verticalAlign: 'top',
              width: `${100 / b.meta.length}%`,
            }}
          >
            <Text style={CAPS}>{m.label}</Text>
            <Text style={{ margin: '3px 0 0', fontSize: '15px', lineHeight: '20px', fontWeight: 700, color: theme.ink }}>
              {m.value}
            </Text>
          </Column>
        ))}
      </Row>
      {b.foot ? (
        <Section style={{ borderTop: `1px dashed ${theme.border}`, padding: '16px 24px 18px' }}>
          <Text style={{ margin: 0, fontSize: '14px', lineHeight: '20px', fontWeight: 700, color: theme.ink }}>
            {b.foot.line}
          </Text>
          {b.foot.note ? (
            <Text
              style={{ margin: '2px 0 0', fontSize: '12.5px', lineHeight: '18px', fontStyle: 'italic', color: theme.muted }}
            >
              {b.foot.note}
            </Text>
          ) : null}
        </Section>
      ) : null}
    </Section>
  )
}
