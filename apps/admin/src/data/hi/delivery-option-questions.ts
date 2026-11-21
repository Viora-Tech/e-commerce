import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { translation } from '@/lib/i18n'

export default [
  translation(deliveryOptionQuestionsContent, {
    title: 'डिलीवरी कीमत',
    whoPays: {
      title: 'डिलीवरी का खर्च कौन देता है?',
      items: {
        route: {
          label: 'ग्राहक कूरियर का खर्च देता है (+ आपका मार्कअप)',
          help: 'कूरियर आपसे जो लेता है, साथ में “और सेटिंग” में रखा कोई भी मार्कअप।',
        },
        zone: {
          label: 'आपके शिपिंग रेट',
          help: 'सेटिंग, शिपिंग और डिलीवरी में आपके लिखे रेट।',
        },
        free: {
          label: 'फ़्री डिलीवरी, कूरियर का खर्च आप देते हैं',
          help: 'शामिल कूरियर के लिए ग्राहक कुछ नहीं देता।',
        },
      },
    },
    faster: {
      title: 'क्या ग्राहक तेज़ कूरियर चुन सकते हैं?',
      items: {
        no: {
          label: () => 'नहीं, सिर्फ़ एक कूरियर दिखाएं',
          help: 'चेकआउट पर सिर्फ़ शामिल कूरियर दिखता है।',
        },
        difference: {
          label: (amount: string | null) =>
            amount ? `हाँ, वे अतिरिक्त देते हैं (+ ${amount})` : 'हाँ, वे अतिरिक्त देते हैं',
          help: 'तेज़ कूरियर सिर्फ़ उतना दिखाता है जितना वह आपको ज़्यादा पड़ता है।',
        },
        full: {
          label: (amount: string | null) =>
            amount ? `हाँ, वे उसकी पूरी कीमत देते हैं (${amount})` : 'हाँ, वे उसकी पूरी कीमत देते हैं',
          help: 'तेज़ कूरियर अपनी डिलीवरी कीमत दिखाता है, पहले कूरियर से कभी कम नहीं।',
        },
      },
      sameNote:
        'अभी तेज़ कूरियर की कीमत पहले कूरियर जितनी है, यह और सेटिंग में तय है। बदलने के लिए कोई कार्ड चुनें।',
    },
    round: {
      title: 'कीमत राउंड करें',
      items: { nine: '₹…9', fifty: '₹…49/…99', ten: '₹10', off: 'बंद' },
    },
    more: {
      title: 'और सेटिंग',
      hintList: 'मार्कअप, सीमाएं, बीमा, COD फ़ीस',
      hintOption: 'मार्कअप, सीमाएं, कूरियर, बीमा, COD, तारीख',
      changed: (n: number) => `${n} बदली गईं`,
      price: 'कीमत',
      sameAsFirst: 'तेज़ कूरियर पहले कूरियर की कीमत पर',
      sameAsFirstHelp:
        'हर कूरियर ग्राहक को एक ही कीमत पर मिलता है। तेज़ कूरियर का अतिरिक्त खर्च आप देते हैं। कम ही चाहिए होता है।',
    },
    summary: {
      pays: {
        route: 'कूरियर खर्च + मार्कअप',
        zone: 'आपके शिपिंग रेट',
        free: 'फ़्री डिलीवरी',
      },
      faster: {
        no: 'एक कूरियर',
        difference: 'तेज़ कूरियर: अतिरिक्त',
        full: 'तेज़ कूरियर: पूरी कीमत',
        same: 'हर कूरियर एक कीमत पर',
      },
      rounded: (to: string) => `${to} तक राउंड`,
      notRounded: 'राउंड नहीं',
      edit: 'बदलें',
      editLabel: (name: string) => `${name} बदलें`,
    },
  }),
]
