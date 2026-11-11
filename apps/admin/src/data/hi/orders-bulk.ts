import { ordersBulkContent, packingSlipsContent } from '@/data/orders-bulk'
import { translation } from '@/lib/i18n'

export default [
  translation(ordersBulkContent, {
    addTags: 'टैग जोड़ें',
    removeTags: 'टैग हटाएं',
    addTagsTitle: (n) => `${n} ऑर्डर में टैग जोड़ें`,
    removeTagsTitle: (n) => `${n} ऑर्डर से टैग हटाएं`,
    tagsDone: (n) => `${n} ऑर्डर के टैग अपडेट हो गए`,
    remind: 'पेमेंट रिमाइंडर भेजें',
    remindTitle: (n) => `${n} ऑर्डर के लिए पेमेंट रिमाइंडर भेजें?`,
    remindBody:
      'UPI या बैंक ट्रांसफ़र से पेमेंट का इंतज़ार कर रहे हर ग्राहक को आपकी पेमेंट जानकारी के साथ ईमेल (और सेट होने पर WhatsApp) जाएगा। जिन ऑर्डर का पेमेंट हो चुका है, जो दूसरे तरीके से चुकाए जाते हैं, या जिन्हें पिछले 6 घंटे में रिमाइंडर गया है, वे छोड़ दिए जाएंगे।',
    remindConfirm: 'रिमाइंडर भेजें',
    remindDone: (sent, skipped, failed) =>
      [
        `${sent} रिमाइंडर भेजे गए`,
        skipped > 0 ? `${skipped} छोड़े गए` : null,
        failed > 0 ? `${failed} नहीं भेजे जा सके` : null,
      ]
        .filter(Boolean)
        .join(', '),
    export: 'CSV में एक्सपोर्ट करें',
    exportDone: (n) => `${n} ऑर्डर एक्सपोर्ट हुए`,
    exportFailed: 'ऑर्डर एक्सपोर्ट नहीं हो पाए',
    print: 'पैकिंग स्लिप प्रिंट करें',
    printTooMany: (max) => `एक बार में ज़्यादा से ज़्यादा ${max} पैकिंग स्लिप प्रिंट करें`,
    printPickList: 'पिक लिस्ट प्रिंट करें',
    printInvoices: 'इनवॉइस प्रिंट करें',
    printIssuedInvoices: (n) => `${n} इनवॉइस प्रिंट करें`,
    printFailed: 'इनवॉइस प्रिंट नहीं हो सके',
    archive: 'ऑर्डर आर्काइव करें',
    unarchive: 'ऑर्डर आर्काइव से निकालें',
    archived: (n, skipped) =>
      `${n} ऑर्डर आर्काइव हुए${skipped > 0 ? `, ${skipped} पहले से आर्काइव थे` : ''}`,
    unarchived: (n, skipped) =>
      `${n} ऑर्डर आर्काइव से निकाले${skipped > 0 ? `, ${skipped} आर्काइव में नहीं थे` : ''}`,
    archiveFailed: 'ऑर्डर नहीं बदल पाए। फिर से कोशिश करें।',
    cancel: 'ऑर्डर कैंसल करें',
    cancelTitle: (n) => (n === 0 ? 'कैंसल करने को कोई ऑर्डर नहीं' : `${n} ऑर्डर कैंसल करें?`),
    cancelBody:
      'सिर्फ़ वही ऑर्डर कैंसल होंगे जिनमें रिफ़ंड करने को कुछ नहीं है: अभी पैसा नहीं मिला (कैश ऑन डिलीवरी नहीं ली गई, चेकआउट का भुगतान नहीं हुआ) या पूरा रिफ़ंड हो चुका है।',
    cancelBodySkipping: (skipped) =>
      `चुने गए ${skipped} ऑर्डर छोड़े जाएंगे: भुगतान हो चुका, शिप हो चुके, इम्पोर्ट किए हुए या पहले से कैंसल। भुगतान वाला ऑर्डर उसके पेज से कैंसल करें, ताकि पैसा कैसे लौटे यह चुन सकें।`,
    cancelRestock: 'आइटम वापस स्टॉक में डालें',
    cancelNotify: 'ग्राहकों को ईमेल करें कि उनका ऑर्डर कैंसल हुआ',
    cancelConfirm: 'ऑर्डर कैंसल करें',
    fulfilTitle: (n) => (n === 0 ? 'भेजने के लिए कोई ऑर्डर नहीं' : `${n} ऑर्डर भेज दिया मार्क करें`),
    fulfilBody: 'हर ऑर्डर का बाकी सामान पैक होगा और आपके चुने कूरियर से जाएगा।',
    fulfilSkipping: (n) => `चुने गए ऑर्डर में से ${n} छोड़े गए: पहले से पैक, कैंसिल या इम्पोर्ट किए हुए।`,
    fulfilCourier: 'कूरियर',
    fulfilCourierName: 'कूरियर का नाम',
    fulfilCourierNamePlaceholder: 'हाथ से डिलीवरी, लोकल कूरियर…',
    fulfilTracking: 'ट्रैकिंग नंबर (ज़रूरी नहीं)',
    fulfilTrackingPlaceholder: 'ट्रैकिंग नंबर',
    fulfilNotListed: (n) => `${n} और ऑर्डर इस पेज पर नहीं हैं; बिना ट्रैकिंग नंबर के पैक होंगे।`,
    fulfilNotify: 'ग्राहकों को बताएँ',
    fulfilConfirm: 'भेज दिया मार्क करें',
    fulfilDone: (n, skipped) =>
      `${n} भेज दिया मार्क हुए` +
      (skipped > 0 ? `, ${skipped} छोड़े गए (पैक करने को कुछ नहीं, होल्ड पर, कैंसिल या इम्पोर्ट किए हुए)` : ''),
    deliveredDone: (n, skipped) =>
      `${n} डिलीवर हो गया मार्क हुए` +
      (skipped > 0 ? `, ${skipped} छोड़े गए (अभी भेजे नहीं गए, कैंसिल या इम्पोर्ट किए हुए)` : ''),
    cancelKeep: 'रहने दें',
    cancelDone: (cancelled, skipped, queued, failed) =>
      [
        `${cancelled} ऑर्डर कैंसल हुए`,
        queued > 0 ? `${queued} मंज़ूरी के लिए भेजे` : null,
        skipped > 0
          ? `${skipped} छोड़े गए (भुगतान हो चुका या अब कैंसल नहीं हो सकते: उन्हें उनके पेज से कैंसल करें)`
          : null,
        failed > 0 ? `${failed} कैंसल नहीं हो पाए` : null,
      ]
        .filter(Boolean)
        .join(', '),
    csv: {
      order: 'ऑर्डर',
      date: 'तारीख',
      customer: 'ग्राहक',
      email: 'ईमेल',
      phone: 'फ़ोन',
      line1: 'पता',
      line2: 'पता लाइन 2',
      city: 'शहर',
      state: 'राज्य',
      pincode: 'पिन कोड',
      total: 'कुल (₹)',
      payment: 'पेमेंट',
      fulfilment: 'भेजने की स्थिति',
      status: 'स्थिति',
      tags: 'टैग',
    },
  }),
  translation(packingSlipsContent, {
    title: 'पैकिंग स्लिप',
    ready: (n) => `${n} पैकिंग स्लिप प्रिंट के लिए तैयार`,
    readyOrders: (n) => `${n} ऑर्डर प्रिंट के लिए तैयार`,
    none: 'प्रिंट करने के लिए कोई ऑर्डर नहीं। पहले ऑर्डर लिस्ट में ऑर्डर चुनें।',
    failed: 'चुने गए कुछ ऑर्डर नहीं मिले, इसलिए उनकी स्लिप नहीं है।',
    print: 'प्रिंट करें',
    back: 'ऑर्डर पर वापस जाएं',
  }),
]
