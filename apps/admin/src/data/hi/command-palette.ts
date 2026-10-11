import { siteConfig } from '@commerce/config/site'
import { paletteContent } from '@/data/command-palette'
import { translation } from '@/lib/i18n'

export default [
  translation(paletteContent, {
    title: 'खोजें',
    description: `ऑर्डर, प्रोडक्ट, ग्राहक और पेज खोजें, या ${siteConfig.brand.name} AI से पूछें।`,
    placeholder: `खोजें या ${siteConfig.brand.name} AI से पूछें…`,
    esc: 'Esc',
    scopesLabel: 'यहाँ खोजें',
    scopes: {
      all: 'सब',
      orders: 'ऑर्डर',
      products: 'प्रोडक्ट',
      customers: 'ग्राहक',
      pages: 'पेज',
      settings: 'सेटिंग्स',
    },
    sections: {
      recent: 'हाल की',
      actions: 'तुरंत काम',
      goTo: 'यहाँ जाएं',
      orders: 'ऑर्डर',
      products: 'प्रोडक्ट',
      customers: 'ग्राहक',
      pages: 'पेज',
      settings: 'सेटिंग्स',
    },
    actions: {
      createProduct: 'प्रोडक्ट बनाएं',
      createOrder: 'ऑर्डर बनाएं',
      createDiscount: 'डिस्काउंट बनाएं',
      createPurchaseOrder: 'परचेज़ ऑर्डर बनाएं',
      openCustomize: 'कस्टमाइज़ खोलें',
    },
    clearRecent: 'हटाएं',
    askAi: (query) => `${siteConfig.brand.name} AI से पूछें: “${query}”`,
    askAiHint: 'अपने स्टोर के डेटा से जवाब पाएं',
    seeAll: (n) => `सभी ${n} देखें →`,
    toggleTheme: 'लाइट और डार्क के बीच बदलें',
    settings: 'सेटिंग्स',
    account: 'आपका अकाउंट',
    breadcrumbSeparator: ' › ',
    order: { guest: 'गेस्ट' },
    product: {
      inStock: (n) => `${n} स्टॉक में`,
      outOfStock: 'स्टॉक खत्म',
      from: (price) => `${price} से`,
    },
    customer: {
      orders: (n) => `${n} ऑर्डर`,
      noOrders: 'अभी कोई ऑर्डर नहीं',
    },
    typeToSearch: {
      orders: 'ऑर्डर ढूंढने के लिए ऑर्डर नंबर, नाम या ईमेल लिखें।',
      products: 'प्रोडक्ट ढूंढने के लिए नाम, टाइप या ब्रांड लिखें।',
      customers: 'ग्राहक ढूंढने के लिए नाम, ईमेल या फ़ोन नंबर लिखें।',
    },
    browse: {
      orders: 'सभी ऑर्डर देखें',
      products: 'सभी प्रोडक्ट देखें',
      customers: 'सभी ग्राहक देखें',
    },
    loading: 'खोज रहे हैं…',
    count: (n) => `${n} नतीजे`,
    noResults: (query) => `“${query}” के लिए कुछ नहीं मिला`,
    noResultsBody: `स्पेलिंग जांचें, कम शब्द लिखें, या ${siteConfig.brand.name} AI से पूछें।`,
    tips: [
      'ऑर्डर नंबर # के साथ या बिना, दोनों चलते हैं',
      'फ़ोन नंबर में कम से कम 4 अंक चाहिए',
      'UPI, GST या कूरियर जैसी सेटिंग आज़माएं',
    ],
    error: {
      title: 'खोज लोड नहीं हुई',
      body: 'इंटरनेट जांचें और फिर कोशिश करें।',
      retry: 'फिर कोशिश करें',
    },
    footer: {
      move: 'चलें',
      open: 'खोलें',
      newTab: 'नया टैब',
      close: 'बंद करें',
      scope: 'फ़िल्टर बदलें',
      keys: { move: '↑↓', open: '↵', scope: 'Tab', close: 'Esc' },
    },
  }),
]
