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
      rate: (rate, inclusive) => `${rate}% · ${inclusive ? 'कीमतों में GST शामिल' : 'ऊपर से जुड़ता है'}`,
      invoices: 'इनवॉइस नंबर',
      invoiceNext: (sample) => `अगला: ${sample}`,
      einvoice: 'ई-इनवॉइस (IRN)',
      einvoiceValue: 'जल्द आ रहा है',
    },

    notifications: {
      back: 'नोटिफ़िकेशन',
      customers: 'ग्राहकों के मैसेज',
      you: 'आपके लिए मैसेज',
      countOn: (on, total) => `${total} में से ${on} चालू`,
      sender: 'भेजने वाला ईमेल',
      senderValue: 'आपके ईमेल किसके नाम से जाते हैं',
      sending: 'मैसेज कैसे भेजे जाते हैं',
      email: 'ईमेल',
      whatsapp: 'WhatsApp',
      notConnected: 'कनेक्ट नहीं',
      advanced: 'एडवांस्ड',
      advancedValue: 'डेवलपर लॉग और ईमेल डिज़ाइन',
    },

    policies: {
      back: 'पॉलिसी',
      list: 'आपकी पॉलिसी',
      published: (n, total) => `${total} में से ${n} पब्लिश`,
      business: 'पॉलिसी पर बिज़नेस का नाम',
      grievance: 'ग्रीवेंस ऑफ़िसर',
    },

    returns: {
      back: 'रिटर्न',
      requests: 'ऑनलाइन रिटर्न रिक्वेस्ट',
      window: (days) => `चालू · डिलीवरी के ${days} दिन तक`,
      reasons: 'रिटर्न की वजहें',
      reasonsValue: (n, total) => `${total} में से ${n}`,
      rules: 'एक्सचेंज और अपने-आप मंज़ूरी',
      exchanges: 'एक्सचेंज',
      autoApprove: 'अपने-आप मंज़ूरी',
      refund: 'रिफ़ंड का सुझाव',
      original: 'जैसे पेमेंट किया',
      storeCredit: 'स्टोर क्रेडिट',
    },
  }),
]
