/**
 * Our own India Post address label: a 4 × 6 inch page (the usual thermal label size) with the article number as a Code 128 barcode, the To and From blocks, the
 * service, weight, and the COD amount to collect when there is one. India Post books the parcel
 * at the counter against its own receipt; this label is what goes on the box. Server only:
 * react-pdf with the vendored fonts of `@commerce/invoices`.
 */
import { join } from 'node:path'
import { code128Widths } from '@commerce/invoices/barcode'
import { fontStack, registerFonts } from '@commerce/invoices/pdf'
import { fontsDir } from '@commerce/invoices/render'
import { formatMoney } from '@commerce/money'
import type { ShipmentAddress } from '@commerce/shipping'
import { Document, Page, Rect, renderToBuffer, Svg, Text, View } from '@react-pdf/renderer'

export type IndiaPostLabelInput = {
  articleNumber: string
  orderNumber: number
  storeName: string
  registered: boolean
  /** Rupees to collect, in paise; 0 for prepaid. */
  codPaise: number
  weightGrams: number | null
  customerId?: string | undefined
  /** "YYYY-MM-DD". */
  bookedOn: string
  to: ShipmentAddress
  from: ShipmentAddress
}

/** 4 × 6 inches in points. */
const PAGE: [number, number] = [288, 432]

function addressLines(a: ShipmentAddress): string[] {
  return [a.line1, a.line2 ?? '', `${a.city}, ${a.state} ${a.pincode}`, `Phone ${a.phone}`].filter(
    (l) => l.trim().length > 0,
  )
}

function Barcode({ value }: { value: string }) {
  const module = 1.6
  const height = 52
  const widths = code128Widths(value)
  const quiet = 10 * module
  const total = widths.reduce((a, w) => a + w, 0) * module + quiet * 2
  let x = quiet
  const bars = widths.flatMap((w, i) => {
    const at = x
    x += w * module
    return i % 2 === 0 ? [{ x: at, w: w * module }] : []
  })
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={total} height={height} viewBox={`0 0 ${total} ${height}`}>
        {bars.map((b) => (
          <Rect key={b.x} x={b.x} y={0} width={b.w} height={height} fill="#000000" />
        ))}
      </Svg>
      <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  )
}

function Party({ heading, address }: { heading: string; address: ShipmentAddress }) {
  return (
    <View style={{ gap: 1.5 }}>
      <Text style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.8 }}>{heading}</Text>
      <Text style={{ fontSize: 11, fontWeight: 700 }}>{address.name}</Text>
      {addressLines(address).map((line) => (
        <Text key={line} style={{ fontSize: 9 }}>
          {line}
        </Text>
      ))}
    </View>
  )
}

const rule = { borderBottomWidth: 1, borderBottomColor: '#000000', borderStyle: 'solid' } as const

export function IndiaPostLabel({
  input,
  fontFamily,
}: {
  input: IndiaPostLabelInput
  fontFamily: string[]
}) {
  const service = input.registered ? 'SPEED POST · REGISTERED' : 'SPEED POST'
  const cod = input.codPaise > 0
  return (
    <Document title={`India Post ${input.articleNumber}`}>
      <Page size={PAGE} style={{ padding: 14, fontFamily, gap: 8, color: '#000000' }}>
        <View
          style={{
            ...rule,
            paddingBottom: 6,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: 700 }}>{service}</Text>
          <Text style={{ fontSize: 12, fontWeight: 700 }}>{cod ? 'COD' : 'PREPAID'}</Text>
        </View>
        <View style={{ ...rule, paddingBottom: 8 }}>
          <Barcode value={input.articleNumber} />
        </View>
        {cod ? (
          <View
            style={{ borderWidth: 1.5, borderColor: '#000000', padding: 6, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 8, fontWeight: 700 }}>CASH ON DELIVERY · COLLECT</Text>
            <Text style={{ fontSize: 16, fontWeight: 700 }}>
              {formatMoney(input.codPaise, 'INR', { showZeroDecimals: true })}
            </Text>
          </View>
        ) : null}
        <View style={{ ...rule, paddingBottom: 8 }}>
          <Party heading="TO" address={input.to} />
        </View>
        <View style={{ ...rule, paddingBottom: 8 }}>
          <Party heading="FROM (IF UNDELIVERED, RETURN TO)" address={input.from} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 8 }}>
          <Text>
            Order #{input.orderNumber} · {input.storeName}
          </Text>
          <Text>{input.weightGrams ? `${(input.weightGrams / 1000).toFixed(3)} kg` : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 8 }}>
          <Text>{input.customerId ? `Customer ID ${input.customerId}` : 'Booked at counter'}</Text>
          <Text>{input.bookedOn}</Text>
        </View>
      </Page>
    </Document>
  )
}

export function labelText(input: IndiaPostLabelInput): string {
  return [input.to, input.from, { name: input.storeName }]
    .flatMap((a) => Object.values(a))
    .join(' ')
}

/** The label as PDF bytes. */
export async function renderIndiaPostLabel(input: IndiaPostLabelInput): Promise<Uint8Array> {
  const dir = fontsDir()
  registerFonts((file) => join(dir, file))
  const element = <IndiaPostLabel input={input} fontFamily={fontStack('inter', labelText(input))} />
  return new Uint8Array(await renderToBuffer(element))
}
