import { growthLinksContent, growthOverviewContent } from '@/data/growth'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(growthOverviewContent, {
    title: 'ग्रोथ',
    intro: 'Instagram, Google, WhatsApp, AI असिस्टेंट और सीधे आने वालों से कितनी बिक्री हो रही है।',
    createCampaign: 'कैंपेन बनाएं',
    kpis: {
      sessions: { label: 'सेशन', help: 'इसे चालू करने के बाद पहली स्टोर विज़िट से गिना गया।' },
      attributed_sales: {
        label: 'मार्केटिंग से बिक्री',
        help: 'वे ऑर्डर जिनकी आख़िरी गैर-सीधी विज़िट किसी चैनल या कैंपेन से आई।',
      },
      attributed_orders: {
        label: 'मार्केटिंग से ऑर्डर',
        help: 'सीधे के अलावा किसी चैनल को मिले ऑर्डर।',
      },
      conversion: { label: 'कन्वर्ज़न रेट', help: 'ट्रैक हुए ऑर्डर को सेशन से भाग देकर।' },
    },
    salesOverTime: {
      title: 'समय के साथ मार्केटिंग से बिक्री',
      day: 'रोज़',
      week: 'हफ़्ते के हिसाब से',
      series: 'मार्केटिंग से बिक्री',
    },
    view: untranslated,
    bestSource: untranslated,
    sources: untranslated,
    channels: untranslated,
    campaigns: untranslated,
    shortcuts: untranslated,
  }),
  translation(growthLinksContent, {
    title: 'लिंक',
    intro:
      'ऐसा लिंक बनाएं जिस पर लिखा हो कि आपने उसे कहां शेयर किया, ताकि ग्रोथ में दिखे कि उससे कितनी बिक्री हुई। इसे जहां पोस्ट करें, वहां यही टैग वाला लिंक चिपकाएं।',
    form: {
      pageLabel: 'किस पेज का लिंक',
      pagePlaceholder: '/products/aapka-product',
      pageHelp: 'आपके स्टोर का रास्ता, जैसे /products/hoodie, या होमपेज के लिए /।',
      placementLabel: 'इसे कहां शेयर करेंगे?',
      campaignLabel: 'कैंपेन का नाम (ज़रूरी नहीं)',
      campaignPlaceholder: 'जैसे diwali-drop',
      campaignHelp: 'कई लिंक को जोड़ें ताकि ग्रोथ में वे एक कैंपेन की तरह दिखें।',
    },
    result: {
      title: 'आपका टैग वाला लिंक',
      copy: 'लिंक कॉपी करें',
      copied: 'कॉपी हो गया',
      empty: 'पेज और शेयर करने की जगह भरें, टैग वाला लिंक मिल जाएगा।',
    },
  }),
]
