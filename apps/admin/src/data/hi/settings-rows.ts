import { settingsRowsContent } from '@/data/settings-rows'
import { translation } from '@/lib/i18n'

export default [
  translation(settingsRowsContent, {
    needsFix: 'ठीक करना है',
    notSet: 'सेट नहीं',
    on: 'चालू',
    off: 'बंद',

    taxes: {
      back: 'GST और इनवॉइस',
      gstNumbers: 'GST नंबर',
      gstCount: (n) => (n === 0 ? 'कोई नहीं जोड़ा' : `${n} नंबर`),
      registration: 'GST रजिस्ट्रेशन',
      notRegistered: 'रजिस्टर्ड नहीं',
      charging: 'आप GST कैसे लेते हैं',
      composition: 'कंपोज़िशन स्कीम',
      rate: (rate, inclusive) =>
        `${rate}% · ${inclusive ? 'कीमतों में GST शामिल' : 'ऊपर से जुड़ता है'}`,
      invoices: 'इनवॉइस नंबर',
      invoiceNext: (sample) => `अगला: ${sample}`,
      einvoice: 'ई-इनवॉइस (IRN)',
      einvoiceValue: 'जल्द आ रहा है',
    },
  }),
]
