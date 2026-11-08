import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { translation } from '@/lib/i18n'

const num = (n: number) => n.toLocaleString('en-IN')

export default [
  translation(shopifyImportRunContent, {
    state: {
      waiting: 'शुरू होने का इंतज़ार',
      previewing: 'प्रीव्यू बन रहा है…',
      ready: 'इंपोर्ट के लिए तैयार',
      importing: 'इंपोर्ट हो रहा है…',
      done: 'पूरा हुआ',
      failed: 'नहीं हो पाया',
      stopped: 'रोका गया',
    },
    started: (when) => `${when} को शुरू हुआ`,
    finished: (when) => `${when} को पूरा हुआ`,
    previewAgain: 'प्रीव्यू फिर चलाएं',
    previewAgainFailed: 'प्रीव्यू शुरू नहीं हो पाया',
    viewStore: 'स्टोर देखें',
    stats: {
      total: 'लाने को',
      created: 'नए',
      updated: 'अपडेट',
      skipped: 'छोड़े गए',
      failed: 'नहीं हो पाए',
    },
    types: {
      done: 'पूरा',
      created: (n) => `${num(n)} नए`,
      updated: (n) => `${num(n)} अपडेट`,
      skipped: (n) => `${num(n)} छोड़े`,
      failed: (n) => `${num(n)} नहीं हुए`,
      nothing: (names) => `लाने को कुछ नहीं: ${names}`,
      credit: (customers, amount, preview) =>
        `स्टोर क्रेडिट: ${num(customers)} ग्राहक, कुल ${amount} ${preview ? 'इंपोर्ट होगा' : 'इंपोर्ट हुआ'}`,
    },
    left: {
      showAll: (n) => `सभी ${num(n)} देखें`,
      showLess: 'कम दिखाएं',
    },
    samples: {
      empty: 'इस तरह का कुछ दिखाने को नहीं है।',
      more: (n) => `इस तरह के ${num(n)} और रिकॉर्ड`,
    },
    problems: {
      summary: (n) => `${num(n)} चीज़ों को देखना ज़रूरी है। बाकी सब हो गया।`,
      none: 'कोई दिक्कत नहीं',
      showRecords: 'हर रिकॉर्ड देखें',
      hideRecords: 'ग्रुप में वापस',
    },
  }),
]
