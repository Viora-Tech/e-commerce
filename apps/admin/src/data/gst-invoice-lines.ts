/** The invoice page's "Items and GST" card (GST invoices app): what the invoice bills and how. */
export const gstInvoiceLinesContent = {
  title: 'Items and GST',
  billTo: 'Bill to',
  shipTo: 'Ship to',
  gstin: (g: string) => `GSTIN ${g}`,
  placeOfSupply: (state: string) => `Place of supply: ${state}`,
  item: 'Item',
  hsn: 'HSN',
  qty: 'Qty',
  rate: 'GST',
  taxable: 'Taxable value',
  tax: 'Tax',
  total: 'Total',
  sku: (sku: string) => `SKU ${sku}`,
  noHsn: 'No HSN',
  cgst: 'CGST',
  sgst: 'SGST',
  igst: 'IGST',
  totalTax: 'Total GST',
  invoiceTotal: 'Invoice total',
  /** Before the discount; shown only when there is one, like the PDF. */
  gross: 'Gross',
  discount: (label: string | null | undefined) => (label ? `Discount (${label})` : 'Discount'),
  /** The per-line discount column, already taken off each line's taxable value and total. */
  lineDiscount: 'Discount',
} as const
