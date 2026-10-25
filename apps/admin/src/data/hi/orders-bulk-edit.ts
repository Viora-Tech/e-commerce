import { ordersBulkEditContent } from '@/data/orders-bulk-edit'
import { translation } from '@/lib/i18n'

export default [
  translation(ordersBulkEditContent, {
    title: 'ऑर्डर बदलें',
    back: 'ऑर्डर',
    summary: (n) => `${n} ऑर्डर`,
    hint: 'सेल पर क्लिक करके लिखें। स्प्रेडशीट से पेस्ट करें, कोना खींचकर नीचे तक भरें, या ऊपर वाला सेल कॉपी करने के लिए Ctrl+D दबाएं। इम्पोर्ट किए ऑर्डर में सिर्फ़ टैग बदले जा सकते हैं।',
    loading: 'ऑर्डर लोड हो रहे हैं',
    loadFailed: 'ऑर्डर लोड नहीं हो पाए',
    save: 'सेव करें',
    saving: 'सेव हो रहा है',
    discard: 'रद्द करें',
    unsaved: (n) => `बिना सेव किए बदलाव · ${n} सेल`,
    noChanges: 'अभी कुछ नहीं बदला',
    columns: {
      number: 'ऑर्डर #',
      placed: 'तारीख़',
      name: 'ग्राहक का नाम',
      email: 'ईमेल',
      phone: 'फ़ोन',
      line1: 'पता, लाइन 1',
      line2: 'पता, लाइन 2',
      city: 'शहर',
      stateCode: 'राज्य',
      pincode: 'पिनकोड',
      tags: 'टैग',
      mark: 'मार्क करें',
    },
    marks: {
      paid: 'भुगतान हुआ',
      fulfilled: 'पूरा हुआ',
      delivered: 'डिलीवर हुआ',
      cancelled: 'रद्द',
    },
    none: '—',
    validation: {
      email: 'सही ईमेल लिखें',
      pincode: 'पिनकोड 6 अंकों का होता है',
      phone: 'फ़ोन अधिकतम 30 अक्षर का हो सकता है',
      name: 'नाम अधिकतम 120 अक्षर का हो सकता है',
      tagCount: 'अधिकतम 20 टैग',
      tagLength: 'हर टैग अधिकतम 40 अक्षर का हो सकता है',
    },
    errors: {
      heading: (n) => `सेव करने से पहले ${n} सेल ठीक करने हैं`,
      rowFailed: (message) => `सेव नहीं हुआ: ${message}`,
      saveFailed: 'बदलाव सेव नहीं हुए',
      rowLabel: (order, column, message) => `#${order} · ${column}: ${message}`,
      more: (n) => `और ${n}`,
    },
    toasts: {
      saved: (ok, failed) =>
        failed > 0 ? `${ok} ऑर्डर सेव हुए, ${failed} नहीं हुए` : `${ok} ऑर्डर सेव हुए`,
    },
    empty: {
      heading: 'बदलने के लिए कुछ नहीं',
      body: 'ऑर्डर पेज पर ऑर्डर चुनें, फिर एक साथ बदलें दबाएं।',
      action: 'ऑर्डर पर वापस',
    },
  }),
]
