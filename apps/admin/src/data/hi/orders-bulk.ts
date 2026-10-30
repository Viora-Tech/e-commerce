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
    archive: 'ऑर्डर आर्काइव करें',
    unarchive: 'ऑर्डर आर्काइव से निकालें',
    archived: (n, skipped) =>
      `${n} ऑर्डर आर्काइव हुए${skipped > 0 ? `, ${skipped} पहले से आर्काइव थे` : ''}`,
    unarchived: (n, skipped) =>
      `${n} ऑर्डर आर्काइव से निकाले${skipped > 0 ? `, ${skipped} आर्काइव में नहीं थे` : ''}`,
    archiveFailed: 'ऑर्डर नहीं बदल पाए। फिर से कोशिश करें।',
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
