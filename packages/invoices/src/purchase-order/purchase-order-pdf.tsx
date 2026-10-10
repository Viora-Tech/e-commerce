import {
  formatPurchaseAmount,
  type PoSheetParty,
  type PurchaseOrderSheet,
  poNumberLabel,
} from '@commerce/core/inventory'
import { Document, type DocumentProps, Page, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

/**
 * The purchase order a store sends its supplier: the same ruled, no-fill look as the Minimal
 * invoice template, in black on white so it prints and faxes cleanly. Amounts are in the
 * order's own currency; landed-cost charges (freight, duty) are the store's and never shown.
 */
const MUTED = '#71717a'
const RULE = '#d4d4d8'
const CELL = { paddingVertical: 10, paddingHorizontal: 14 }

type Column = {
  key: string
  label: string
  width: number
  align: 'left' | 'right'
  render: (line: PurchaseOrderSheet['lines'][number], index: number) => string
}

function columns(sheet: PurchaseOrderSheet): Column[] {
  const money = (minor: number) => formatPurchaseAmount(minor, sheet.currency)
  const hsn = sheet.lines.some((l) => l.hsnCode)
  return [
    { key: 'n', label: '#', width: 5, align: 'left', render: (_, i) => String(i + 1) },
    { key: 'item', label: 'Item', width: hsn ? 41 : 53, align: 'left', render: (l) => l.title },
    ...(hsn
      ? [
          {
            key: 'hsn',
            label: 'HSN',
            width: 12,
            align: 'left' as const,
            render: (l: PurchaseOrderSheet['lines'][number]) => l.hsnCode ?? '',
          },
        ]
      : []),
    { key: 'qty', label: 'Qty', width: 10, align: 'right', render: (l) => String(l.quantity) },
    {
      key: 'price',
      label: 'Unit price',
      width: 16,
      align: 'right',
      render: (l) => money(l.unitPriceMinor),
    },
    {
      key: 'total',
      label: 'Amount',
      width: 16,
      align: 'right',
      render: (l) => money(l.totalMinor),
    },
  ]
}

function Party({
  heading,
  party,
  ruled,
}: {
  heading: string
  party: PoSheetParty
  ruled?: boolean
}) {
  return (
    <View style={{ ...CELL, flex: 1, gap: 2, borderLeftWidth: ruled ? 0.5 : 0, borderColor: RULE }}>
      <Text style={{ color: MUTED, marginBottom: 2 }}>{heading}</Text>
      <Text style={{ fontWeight: 600 }}>{party.name}</Text>
      {party.address.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      {party.gstin ? <Text>GSTIN {party.gstin}</Text> : null}
      {party.phone ? <Text style={{ color: MUTED }}>{party.phone}</Text> : null}
      {party.email ? <Text style={{ color: MUTED }}>{party.email}</Text> : null}
    </View>
  )
}

export default function PurchaseOrderPdf({
  sheet,
  fontFamily,
}: {
  sheet: PurchaseOrderSheet
  fontFamily: string[]
}) {
  const cols = columns(sheet)
  const meta = [
    { label: 'Date', value: sheet.dateLabel },
    ...(sheet.expectedLabel ? [{ label: 'Deliver by', value: sheet.expectedLabel }] : []),
    { label: 'Currency', value: sheet.currency },
    ...(sheet.paymentTerms ? [{ label: 'Payment terms', value: sheet.paymentTerms }] : []),
  ]

  return (
    <Document
      title={`Purchase order ${poNumberLabel(sheet.number)}`}
      author={sheet.buyer.name}
      creator={sheet.buyer.name}
      producer="Commerce"
    >
      <Page
        size="A4"
        style={{ fontSize: 8, fontFamily, color: '#18181b', borderWidth: 0.5, borderColor: RULE }}
      >
        <View
          style={{
            ...CELL,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottomWidth: 0.5,
            borderColor: RULE,
          }}
        >
          <View>
            <Text style={{ fontSize: 7.5, color: MUTED }}>Purchase order</Text>
            <Text style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.8 }}>
              {poNumberLabel(sheet.number)}
            </Text>
          </View>
          <View style={{ gap: 2 }}>
            {meta.map((m) => (
              <View key={m.label} style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 7.5, color: MUTED, marginRight: 8 }}>{m.label}</Text>
                <Text style={{ fontSize: 7.5, maxWidth: 160, textAlign: 'right' }}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderColor: RULE }}>
          <Party heading="Buyer" party={sheet.buyer} />
          <Party heading="Ship to" party={sheet.shipTo} ruled />
          <Party heading="Supplier" party={sheet.supplier} ruled />
        </View>

        <View style={{ flexGrow: 1 }}>
          <View
            fixed
            style={{
              flexDirection: 'row',
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderBottomWidth: 0.5,
              borderColor: RULE,
            }}
          >
            {cols.map((c) => (
              <Text
                key={c.key}
                style={{ width: `${c.width}%`, textAlign: c.align, fontSize: 7, color: MUTED }}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {sheet.lines.map((l, i) => (
            <View
              key={l.variantId}
              wrap={false}
              style={{
                flexDirection: 'row',
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderBottomWidth: 0.5,
                borderColor: RULE,
              }}
            >
              {cols.map((c) => (
                <View key={c.key} style={{ width: `${c.width}%` }}>
                  <Text style={{ textAlign: c.align, fontSize: 7.5 }}>{c.render(l, i)}</Text>
                  {c.key === 'item' && l.sku ? (
                    <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 1 }}>SKU {l.sku}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View wrap={false} style={{ flexDirection: 'row', borderTopWidth: 0.5, borderColor: RULE }}>
          <View style={{ ...CELL, flex: 1, gap: 2, borderRightWidth: 0.5, borderColor: RULE }}>
            {sheet.note ? (
              <>
                <Text>Notes</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{sheet.note}</Text>
              </>
            ) : null}
          </View>
          <View style={{ width: '45%' }}>
            <View style={{ ...CELL, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: MUTED }}>Units</Text>
              <Text>{sheet.units}</Text>
            </View>
            <View
              style={{
                ...CELL,
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderTopWidth: 0.5,
                borderColor: RULE,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: 600 }}>Total</Text>
              <Text style={{ fontSize: 12, fontWeight: 600 }}>
                {formatPurchaseAmount(sheet.totalMinor, sheet.currency)}
              </Text>
            </View>
          </View>
        </View>
        <Text
          style={{
            ...CELL,
            fontSize: 6.5,
            color: MUTED,
            textAlign: 'center',
            borderTopWidth: 0.5,
            borderColor: RULE,
          }}
        >
          Please quote {poNumberLabel(sheet.number)} on your invoice and every package.
        </Text>
      </Page>
    </Document>
  )
}

/** The react-pdf <Document> for `renderToBuffer`. Fonts must already be registered. */
export function purchaseOrderElement(
  sheet: PurchaseOrderSheet,
  fontFamily: string[],
): ReactElement<DocumentProps> {
  return <PurchaseOrderPdf sheet={sheet} fontFamily={fontFamily} />
}
