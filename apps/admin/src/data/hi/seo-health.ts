import { seoHealthContent } from '@/data/seo-health'
import { translation } from '@/lib/i18n'

export default [
  translation(seoHealthContent, {
    title: 'SEO',
    intro:
      'Google और Bing आपके प्रोडक्ट, कलेक्शन और पेज के लिए क्या दिखाते हैं। हम वह सब जाँचते हैं जो ग्राहक देख सकते हैं।',
    checkedItems: (products, collections, pages) =>
      `${products} प्रोडक्ट, ${collections} कलेक्शन और ${pages} पेज जाँचे`,
    passed: (n, total) => `${total} में से ${n} ठीक`,
    loading: 'आपकी लिस्टिंग जाँच रहे हैं…',
    failed: 'लिस्टिंग की जाँच नहीं हो सकी। थोड़ी देर में फिर कोशिश करें।',
    recheck: 'फिर जाँचें',
    pass: 'ठीक',
    fail: 'ठीक करें',
    more: (n) => `और ${n}`,
    report: 'SEO रिपोर्ट खोलें',
    resource: { product: 'प्रोडक्ट', collection: 'कलेक्शन', page: 'पेज' },
    checks: {
      description_missing: {
        title: 'हर लिस्टिंग का सर्च विवरण है',
        fix: (n) =>
          `${n} आइटम का न सर्च विवरण है न विवरण का टेक्स्ट, इसलिए Google खुद कुछ बना लेता है। एक लिखें, या SEO रिपोर्ट पर Fix with AI चलाएँ।`,
      },
      title_short: {
        title: 'टाइटल पूरी बात कहते हैं',
        fix: (n) => `${n} आइटम का टाइटल 15 अक्षर से छोटा है। बताएँ कि यह क्या है और किसके लिए है।`,
      },
      title_duplicate: {
        title: 'हर टाइटल अलग है',
        fix: (n) => `${n} आइटम का टाइटल किसी दूसरे से मिलता है, इसलिए सर्च इंजन उन्हें अलग नहीं कर पाते।`,
      },
      alt_missing: {
        title: 'प्रोडक्ट फ़ोटो में alt टेक्स्ट है',
        fix: (n, images) =>
          `${n} प्रोडक्ट की ${images} फ़ोटो में alt टेक्स्ट नहीं है। इमेज सर्च और स्क्रीन रीडर को इसकी ज़रूरत है।`,
      },
      handle_copy: {
        title: 'कोई वेब पता “-copy” पर ख़त्म नहीं होता',
        fix: (n) =>
          `${n} प्रोडक्ट डुप्लिकेट किए गए और वेब पते में “-copy” रह गया। Search engine listing में हैंडल बदलें।`,
      },
    },
  }),
]
