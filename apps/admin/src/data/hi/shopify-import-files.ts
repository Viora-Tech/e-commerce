import { shopifyImportFilesContent } from '@/data/shopify-import-files'
import { translation } from '@/lib/i18n'

const num = (n: number) => n.toLocaleString('en-IN')

export default [
  translation(shopifyImportFilesContent, {
    heading: 'कॉपी होने वाली फ़ाइलें',
    line: (images, videos, size) =>
      `${num(images)} फ़ोटो · ${num(videos)} वीडियो, ऑप्टिमाइज़ होने के बाद करीब ${size}`,
    unused: (n, size) =>
      `${num(n)} फ़ाइलें (करीब ${size}) जिन्हें कोई इस्तेमाल नहीं करता, Shopify में रहेंगी। उन्हें कॉपी करने के लिए पिछले स्टेप पर “बिना इस्तेमाल वाली फ़ाइलें भी इंपोर्ट करें” चुनें।`,
    unusedIncluded: 'बिना इस्तेमाल वाली फ़ाइलें भी शामिल हैं।',
    note: 'सिर्फ़ थीम में इस्तेमाल होने वाले वीडियो थीम इंपोर्ट करते समय कॉपी होते हैं।',
  }),
]
