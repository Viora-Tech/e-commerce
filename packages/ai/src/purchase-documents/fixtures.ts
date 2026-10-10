/**
 * What the offline mock model (`AI_PROVIDER=mock`) "reads" from any purchase document, one
 * fixed answer per shape, so demos and tests always see the same lines. Made-up companies and
 * numbers; the Bill of Entry's duties follow the supplier invoice at 83.25 rupees a dollar
 * (BCD 10%, SWS 10% of BCD, IGST 18%). Line two's HSN code is deliberately low-confidence.
 */
import type { BillOfEntry, DocumentShape, ServiceBill, SupplierInvoice } from './schema'

const sure = <T>(value: T) => ({ value, confidence: 0.95 })
const unsure = <T>(value: T) => ({ value, confidence: 0.55 })
const none = { value: null, confidence: 0 }

const MOCK_SUPPLIER_INVOICE: SupplierInvoice = {
  supplierName: sure('Example Trading Co., Shenzhen'),
  invoiceNumber: sure('EX-2026-0042'),
  invoiceDate: sure('2026-09-28'),
  currency: sure('USD'),
  lines: [
    {
      description: sure('Wireless mouse M1, black'),
      supplierSku: sure('M1-BLK'),
      hsnCode: sure('84716060'),
      quantity: sure(98),
      unitPrice: sure(12.4),
      lineTotal: sure(1215.2),
    },
    {
      description: sure('Mechanical keyboard K2, red switches'),
      supplierSku: sure('K2-RED'),
      hsnCode: unsure('84716040'),
      quantity: sure(50),
      unitPrice: sure(28),
      lineTotal: sure(1400),
    },
  ],
  freight: sure(45),
  insurance: none,
  total: sure(2660.2),
}

const MOCK_BILL_OF_ENTRY: BillOfEntry = {
  beNumber: sure('7654321'),
  beDate: sure('2026-10-02'),
  port: sure('INNSA1'),
  currency: sure('USD'),
  exchangeRate: sure(83.25),
  lines: [
    {
      description: sure('Wireless mouse M1'),
      hsnCode: sure('84716060'),
      quantity: sure(98),
      assessableValue: sure(101200),
      bcd: sure(10120),
      sws: sure(1012),
      igst: sure(20219.76),
    },
    {
      description: sure('Mechanical keyboard K2'),
      hsnCode: sure('84716040'),
      quantity: sure(50),
      assessableValue: sure(116600),
      bcd: sure(11660),
      sws: sure(1166),
      igst: sure(23296.68),
    },
  ],
  totalAssessableValue: sure(217800),
  totalBcd: sure(21780),
  totalSws: sure(2178),
  totalIgst: sure(43516.44),
}

const MOCK_SERVICE_BILL: ServiceBill = {
  payee: sure('Example Freight Forwarders'),
  billNumber: sure('EFF/2026/118'),
  billDate: sure('2026-10-03'),
  currency: sure('INR'),
  amount: sure(18500),
  gst: sure(3330),
  total: sure(21830),
  description: sure('Ocean freight and documentation'),
}

export const MOCK_DOCUMENTS: Record<DocumentShape, unknown> = {
  supplier_invoice: MOCK_SUPPLIER_INVOICE,
  bill_of_entry: MOCK_BILL_OF_ENTRY,
  service_bill: MOCK_SERVICE_BILL,
}
