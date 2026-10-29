import { searchFiltersContent } from '@/data/search-filters'
import { translation } from '@/lib/i18n'

export default [
  translation(searchFiltersContent, {
    title: 'फ़िल्टर',
    subtitle:
      'चुनें कि कलेक्शन और सर्च पेज पर ग्राहकों को कौन से फ़िल्टर दिखें और किस क्रम में। आपकी थीम और इम्पोर्ट की गई Shopify थीम, दोनों पर काम करता है।',
    list: {
      title: 'स्टोरफ़्रंट फ़िल्टर',
      description: 'ऊपर से नीचे दिखते हैं। जिस पेज पर किसी फ़िल्टर में चुनने को कुछ नहीं, वहाँ वह छिप जाता है।',
      usingDefault:
        'अभी डिफ़ॉल्ट फ़िल्टर चल रहे हैं: उपलब्धता, कीमत, हर वेरिएंट ऑप्शन, फिर टाइप, ब्रांड और टैग। अपने फ़िल्टर चुनने के लिए नीचे कुछ भी बदलें।',
      empty: 'कोई फ़िल्टर नहीं। कलेक्शन और सर्च पेज पर फ़िल्टर पैनल नहीं दिखेगा।',
      add: 'फ़िल्टर जोड़ें',
      save: 'फ़िल्टर सेव करें',
      saved: 'फ़िल्टर सेव हो गए',
      reset: 'डिफ़ॉल्ट फ़िल्टर इस्तेमाल करें',
      resetDone: 'डिफ़ॉल्ट फ़िल्टर वापस लग गए',
      labelFor: (name: string) => `${name} के लिए ग्राहकों को दिखने वाला नाम`,
      labelPlaceholder: 'डिफ़ॉल्ट नाम',
      moveUp: (name: string) => `${name} को ऊपर ले जाएँ`,
      moveDown: (name: string) => `${name} को नीचे ले जाएँ`,
      remove: (name: string) => `${name} हटाएँ`,
    },
    source: {
      availability: 'उपलब्धता',
      price: 'कीमत',
      giftCard: 'गिफ़्ट कार्ड या प्रोडक्ट',
      productType: 'प्रोडक्ट टाइप',
      vendor: 'ब्रांड',
      tags: 'सभी टैग',
      option: 'वेरिएंट ऑप्शन',
      metafield: 'प्रोडक्ट फ़ील्ड',
      tagGroup: 'टैग समूह',
    },
    detail: {
      availability: 'स्टॉक में या स्टॉक में नहीं',
      price: 'कीमत की सीमा, से–तक',
      giftCard: 'तब दिखता है जब पेज पर दोनों हों',
      productType: (n: number) => `${n} टाइप`,
      vendor: (n: number) => `${n} ब्रांड`,
      tags: 'हर टैग, 30 तक',
      option: (n: number) => `${n} वैल्यू`,
      metafield: (n: number) => `${n} प्रोडक्ट में वैल्यू है`,
      tagGroup: (prefix: string, values: string) => `“${prefix}-” से शुरू होने वाले टैग: ${values}`,
    },
    dialog: {
      title: 'फ़िल्टर जोड़ें',
      description:
        'चुनें कि फ़िल्टर की वैल्यू कहाँ से आएँ। hand-large और hand-small जैसे टैग एक फ़िल्टर “Hand” बन जाते हैं, Large और Small के साथ।',
      builtIn: 'पहले से मौजूद',
      options: 'वेरिएंट ऑप्शन',
      metafields: 'प्रोडक्ट फ़ील्ड',
      tagGroups: 'टैग समूह',
      customPrefix: 'दूसरा टैग प्रीफ़िक्स',
      customPrefixHelp: 'डैश से पहले का हिस्सा लिखें, जैसे hand-large के लिए hand।',
      customPrefixAdd: 'जोड़ें',
      nothing: 'हर फ़िल्टर पहले से सूची में है।',
      close: 'हो गया',
    },
    failed: 'सेव नहीं हो पाया। फिर से कोशिश करें।',
  }),
]
