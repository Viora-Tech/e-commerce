import { customersBulkEditContent } from '@/data/customers-bulk-edit'
import { translation } from '@/lib/i18n'

export default [
  translation(customersBulkEditContent, {
    title: 'ग्राहक बदलें',
    back: 'ग्राहक',
    summary: (n) => `${n} ग्राहक`,
    hint: 'सेल पर क्लिक करके लिखें। स्प्रेडशीट से पेस्ट करें, कोना खींचकर नीचे तक भरें, या ऊपर वाला सेल कॉपी करने के लिए Ctrl+D दबाएं। मार्केटिंग के लिए तभी सब्सक्राइब करें जब ग्राहक ने हामी भरी हो; हर बदलाव उनकी सहमति हिस्ट्री में रहता है।',
    loading: 'ग्राहक लोड हो रहे हैं',
    loadFailed: 'ग्राहक लोड नहीं हो पाए',
    save: 'सेव करें',
    saving: 'सेव हो रहा है',
    discard: 'रद्द करें',
    unsaved: (n) => `बिना सेव किए बदलाव · ${n} सेल`,
    noChanges: 'अभी कुछ नहीं बदला',
    columns: {
      email: 'ईमेल',
      name: 'नाम',
      phone: 'फ़ोन',
      tags: 'टैग',
      note: 'नोट',
      acceptsMarketing: 'ईमेल मार्केटिंग',
      acceptsWhatsapp: 'WhatsApp मार्केटिंग',
      acceptsSms: 'SMS मार्केटिंग',
    },
    consent: { yes: 'सब्सक्राइब्ड', no: 'सब्सक्राइब्ड नहीं' },
    noEmail: 'ईमेल नहीं',
    validation: {
      name: 'नाम अधिकतम 200 अक्षर का हो सकता है',
      phone: 'फ़ोन अधिकतम 30 अक्षर का हो सकता है',
      note: 'नोट अधिकतम 2,000 अक्षर का हो सकता है',
      tagCount: 'अधिकतम 50 टैग',
      tagLength: 'हर टैग अधिकतम 40 अक्षर का हो सकता है',
    },
    errors: {
      heading: (n) => `सेव करने से पहले ${n} सेल ठीक करने हैं`,
      rowFailed: (message) => `सेव नहीं हुआ: ${message}`,
      saveFailed: 'बदलाव सेव नहीं हुए',
      rowLabel: (customer, column, message) => `${customer} · ${column}: ${message}`,
      more: (n) => `और ${n}`,
    },
    toasts: {
      saved: (ok, failed) =>
        failed > 0 ? `${ok} ग्राहक सेव हुए, ${failed} नहीं हुए` : `${ok} ग्राहक सेव हुए`,
    },
    empty: {
      heading: 'बदलने के लिए कुछ नहीं',
      body: 'ग्राहक पेज पर ग्राहक चुनें, फिर एक साथ बदलें दबाएं।',
      action: 'ग्राहकों पर वापस',
    },
  }),
]
