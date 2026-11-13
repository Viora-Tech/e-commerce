import { gstExportContent, gstQueuePageContent } from '@/data/gst-queue-page'
import { translation } from '@/lib/i18n'

export default [
  translation(gstQueuePageContent, {
    title: 'कतार',
    subtitle: {
      payment:
        'इनवॉइस के इंतज़ार में ऑर्डर। भुगतान हुए ऑर्डर अपने आप जुड़ते हैं; इन्हें एक-एक करके या सब एक साथ जारी करें।',
      fulfilment:
        'इनवॉइस के इंतज़ार में ऑर्डर। ऑर्डर शिप होते ही जुड़ते हैं; इन्हें एक-एक करके या सब एक साथ जारी करें।',
      manual:
        'इनवॉइस के इंतज़ार में ऑर्डर। More मेनू से नंबर डालकर ऑर्डर जोड़ें; इन्हें एक-एक करके या सब एक साथ जारी करें।',
    },
    stats: {
      issued: 'इस महीने जारी',
      taxable: (amount) => `${amount} कर योग्य`,
      waiting: 'इंतज़ार में',
      needHsn: (n) => `${n} में HSN कोड चाहिए`,
      needFix: (n) => `${n} ठीक करने हैं`,
      allReady: 'सब जारी करने को तैयार',
      creditNotes: 'क्रेडिट नोट',
      nextNumber: 'अगला नंबर',
      resets: (date) => `${date} को फिर 1 से`,
      neverResets: 'एक ही गिनती, कभी रीसेट नहीं',
      noSeries: 'टैक्स इनवॉइस की कोई सीरीज़ नहीं',
    },
    chips: { all: 'सभी', ready: 'तैयार', fix: 'ठीक करना है' },
    columns: {
      order: 'ऑर्डर',
      customer: 'ग्राहक',
      gstin: 'GSTIN',
      taxable: 'कर योग्य',
      gst: 'GST',
      status: 'स्थिति',
      action: 'कार्रवाई',
    },
    statuses: {
      ready: 'तैयार',
      ready_b2b: 'तैयार · B2B',
      ready_export: 'तैयार · निर्यात',
      hsn_missing: 'HSN नहीं है',
      buyer_details: 'खरीदार की जानकारी अधूरी',
    },
    fixHelp: {
      hsn_missing: 'इस प्रोडक्ट में HSN कोड जोड़ें, या सेटिंग में डिफ़ॉल्ट HSN सेट करें',
      buyer_details:
        'बिना GSTIN वाले खरीदार को Rs 50,000 या उससे ज़्यादा की बिक्री पर उनका नाम, पता और राज्य चाहिए। इन्हें ऑर्डर पर जोड़ें।',
    },
    issue: 'जारी करें',
    fix: 'ठीक करें',
    issueMany: (n) => `${n} इनवॉइस जारी करें`,
    selectAll: 'दिखाए गए सभी ऑर्डर चुनें',
    selectRow: (order) => `${order} चुनें`,
    selected: (n) => `${n} चुने गए`,
    more: 'कतार के और विकल्प',
    addByNumber: 'नंबर से ऑर्डर जोड़ें',
    filterDates: 'तारीख़ से छाँटें',
    removeSelected: 'चुने हुए कतार से हटाएँ',
    clearDates: 'तारीख़ें हटाएँ',
    dateRange: (from, to) => `${from || '…'} से ${to || '…'} तक`,
    addTitle: 'कतार में ऑर्डर जोड़ें',
    addBody: 'ऑर्डर नंबर कॉमा या स्पेस से अलग करके लिखें, जैसे 1042, 1043।',
    addField: 'ऑर्डर नंबर',
    datesTitle: 'इन तारीख़ों के बीच के ऑर्डर दिखाएँ',
    apply: 'लागू करें',
    noneReady: 'अभी कुछ जारी करने को तैयार नहीं। पहले पीले निशान वाली पंक्तियाँ ठीक करें।',
    noneToFix: 'कुछ ठीक नहीं करना है। इंतज़ार वाला हर ऑर्डर जारी किया जा सकता है।',
    none: '-',
    statsFailed: 'इस महीने के आंकड़े लोड नहीं हो सके',
  }),
  translation(gstExportContent, {
    label: 'GSTR-1 एक्सपोर्ट करें',
    month: (label) => `GSTR-1 JSON, ${label}`,
    thisMonth: (label) => `GSTR-1 JSON, ${label} (अब तक)`,
    returns: 'सभी रिटर्न और डाउनलोड',
    failed: 'GSTR-1 एक्सपोर्ट नहीं हो सका',
  }),
]
