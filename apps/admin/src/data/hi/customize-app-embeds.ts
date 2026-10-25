import { customizeContent } from '@/data/customize'
import { translation } from '@/lib/i18n'

export default [
  translation(customizeContent.appEmbeds, {
    intro: 'आपके ऐप्स स्टोर के हर पेज पर जो जोड़ते हैं, जैसे चैट बटन।',
    search: 'ऐप एम्बेड खोजें',
    noMatch: 'कोई ऐप एम्बेड नहीं मिला',
    emptyTitle: 'अभी कोई ऐप एम्बेड नहीं',
    emptyBody: 'आपके इंस्टॉल किए ऐप्स हर पेज पर कुछ जोड़ सकते हैं, जैसे चैट बटन। वे यहाँ दिखेंगे।',
    browse: 'ऐप स्टोर देखें',
    toggle: (name: string) => `${name} को स्टोर पर दिखाएँ`,
    settings: 'सेटिंग्स',
    hideSettings: 'सेटिंग्स छिपाएँ',
    noSettings: 'सेट करने को कुछ नहीं है।',
    hint: 'चालू किए एम्बेड सेव करने के बाद आपके स्टोर पर दिखेंगे।',
  }),
]
