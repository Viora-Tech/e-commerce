import { customizeContent } from '@/data/customize'
import { translation } from '@/lib/i18n'

export default [
  translation(customizeContent.media, {
    search: 'तस्वीरें खोजें',
    empty: 'अभी कोई तस्वीर नहीं',
    emptyHint: 'एक अपलोड करें, या Content › Files में जोड़ें।',
    noMatch: 'कोई तस्वीर नहीं मिली',
    upload: 'अपलोड करें',
    uploading: 'अपलोड हो रही है…',
    uploadFailed: 'यह तस्वीर अपलोड नहीं हो सकी',
    more: 'और दिखाएँ',
    drop: 'अपलोड करने के लिए फ़ाइलें यहाँ छोड़ें',
    dropNow: 'अपलोड करने के लिए छोड़ें',
    browse: 'या चुनने के लिए क्लिक करें',
    used: 'इस्तेमाल में',
    unused: 'इस्तेमाल में नहीं',
    usedHint: 'इस पेज पर इस्तेमाल हुई है',
    hint: 'तस्वीर को किसी सेक्शन पर खींचकर छोड़ें, या सेक्शन चुनकर तस्वीर पर क्लिक करें।',
    use: (name: string) => `${name} इस्तेमाल करें`,
    picture: 'तस्वीर',
    selectFirst: 'पहले एक सेक्शन चुनें, फिर उसके लिए तस्वीर चुनें।',
    noTarget: (name: string) => `${name} में तस्वीर की कोई सेटिंग नहीं है।`,
    placed: (name: string) => `${name} में तस्वीर जोड़ी गई`,
  }),
]
