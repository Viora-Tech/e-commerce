import { dynamicSourcePickerContent } from '@/data/dynamic-sources'
import { translation } from '@/lib/i18n'

export default [
  translation(dynamicSourcePickerContent, {
    title: 'डायनामिक सोर्स जोड़ें',
    intro: {
      text: 'टाइप करने की जगह अपने स्टोर का टेक्स्ट दिखाएँ।',
      richtext: 'टाइप करने की जगह अपने स्टोर का टेक्स्ट दिखाएँ।',
      image: 'अपलोड करने की जगह अपने स्टोर की इमेज दिखाएँ।',
      link: 'अपने स्टोर के किसी पेज से लिंक करें।',
      url: 'अपने स्टोर के किसी पेज से लिंक करें।',
      number: 'अपने स्टोर का कोई नंबर इस्तेमाल करें।',
      color: 'अपने स्टोर में सेव किया रंग इस्तेमाल करें।',
    },
    sections: {
      product: 'प्रोडक्ट',
      collection: 'कलेक्शन',
      shop: 'स्टोर',
    },
    contentType: 'कंटेंट टाइप',
    count: (n: number) => `${n} सोर्स`,
    search: 'सोर्स खोजें',
    loading: 'सोर्स लोड हो रहे हैं',
    failed: 'सोर्स लोड नहीं हो पाए',
    empty: 'आपके स्टोर में अभी इस सेटिंग के लायक कुछ नहीं है।',
    emptyHelp: 'Settings › Custom data में एक्स्ट्रा फ़ील्ड जोड़ें, या Content › Content types में एंट्री।',
    noMatch: (query: string) => `“${query}” से कोई सोर्स नहीं मिला`,
    noMatchHelp: 'किसी फ़ील्ड, कंटेंट टाइप या उसकी एंट्री का नाम खोजें।',
    clear: 'खोज साफ़ करें',
    connected: 'जुड़ा है',
    keys: '↑ ↓ से चुनें और Enter से जोड़ें।',
    cancel: 'रद्द करें',
  }),
]
