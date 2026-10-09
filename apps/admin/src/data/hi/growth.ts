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
    view: { label: 'देखें', bySource: 'सोर्स के हिसाब से', byChannel: 'चैनल के हिसाब से' },
    bestSource: {
      title: 'इस अवधि में आपका सबसे अच्छा सोर्स {source} है',
      body: 'सीधे आने वालों को छोड़कर, सबसे ज़्यादा बिक्री इसी से आई।',
    },
    sources: {
      title: 'सोर्स के हिसाब से बिक्री',
      empty:
        'इस रेंज में अभी कोई विज़िट नहीं। जैसे ही ग्राहक Instagram, Google, WhatsApp, AI असिस्टेंट वगैरह से आएँगे, सोर्स यहाँ दिखेंगे। हर लिंक सही दिखे, इसलिए उन्हें लिंक पेज पर टैग करें।',
      columns: {
        source: 'सोर्स',
        sessions: 'विज़िट',
        orders: 'ऑर्डर',
        sales: 'बिक्री',
        conversion: 'कन्वर्ज़न',
        share: 'बिक्री का हिस्सा',
      },
      campaignsUnder: 'इस सोर्स के कैंपेन',
      noCampaigns: 'इस सोर्स से अभी कोई टैग किया लिंक या कैंपेन नहीं।',
    },
    channels: {
      title: 'चैनल के हिसाब से विज़िट और बिक्री',
      empty:
        'इस रेंज में अभी कोई विज़िट नहीं। जैसे ही ग्राहक सर्च, सोशल, ईमेल और WhatsApp से आएँगे, चैनल यहाँ दिखेंगे।',
      columns: {
        channel: 'चैनल',
        sessions: 'विज़िट',
        orders: 'ऑर्डर',
        sales: 'बिक्री',
        conversion: 'कन्वर्ज़न',
      },
    },
    campaigns: {
      title: 'टॉप कैंपेन',
      empty:
        'अभी दिखाने को कुछ नहीं। लिंक पर utm_campaign टैग लगाएँ, या ईमेल / WhatsApp कैंपेन भेजें, नतीजे यहाँ आएँगे।',
      columns: {
        campaign: 'कैंपेन',
        source: 'सोर्स / माध्यम',
        sessions: 'विज़िट',
        orders: 'ऑर्डर',
        sales: 'बिक्री',
      },
      kinds: {
        email: 'ईमेल',
        whatsapp: 'WhatsApp',
        automation: 'ऑटोमेशन',
        utm: 'टैग किया लिंक',
      },
    },
    shortcuts: {
      title: 'अपने ग्राहकों तक पहुँचें',
      campaigns: {
        title: 'कैंपेन',
        body: 'ग्राहकों के किसी सेगमेंट को ईमेल या WhatsApp ब्रॉडकास्ट भेजें।',
        href: untranslated,
      },
      automations: {
        title: 'ऑटोमेशन',
        body: 'छोड़े हुए चेकआउट वापस पाएँ, नए सब्सक्राइबर का स्वागत करें और पुराने खरीदारों को वापस लाएँ।',
        href: untranslated,
      },
      links: {
        title: 'लिंक',
        body: 'अपने Instagram बायो, WhatsApp ब्रॉडकास्ट या विज्ञापन के लिए टैग किया लिंक बनाएँ।',
        href: untranslated,
      },
      discounts: {
        title: 'डिस्काउंट',
        body: 'कैंपेन और ऑटोमेशन में इस्तेमाल करने के लिए कोड बनाएँ।',
        href: untranslated,
      },
    },
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
