import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { translation } from '@/lib/i18n'

export default [
  translation(deliveryRuleFormContent, {
    presets: {
      label: 'जल्दी शुरू करें',
      help: 'फ़ॉर्म भर देता है। सेव करने से पहले आप कुछ भी बदल सकते हैं।',
      items: {
        freePreferred: {
          title: 'पसंदीदा कूरियर से मुफ़्त',
          body: 'माउस की तरह: एक कूरियर से मुफ़्त, ग्राहक दूसरा चुनकर अंतर दे सकते हैं।',
        },
        oneFree: {
          title: 'सिर्फ़ एक कूरियर, मुफ़्त',
          body: 'ग्लास पैड की तरह: हमेशा वही कूरियर, कोई और विकल्प नहीं।',
        },
        paidCheapest: {
          title: 'पैसे वाली, सबसे सस्ता पहले',
          body: 'स्केट्स की तरह: सामान्य डिलीवरी कीमत, सबसे सस्ता कूरियर पहले।',
        },
      },
    },
    steps: {
      products: 'कौन से प्रोडक्ट?',
      couriers: 'कौन से कूरियर इन्हें ले जा सकते हैं?',
      couriersHelp: 'ग्राहक इन कूरियर में से चुन सकते हैं।',
      included: 'कीमत में कौन सा कूरियर शामिल है?',
      includedHelp:
        'यह सबसे पहले दिखता है और "सुझाया गया" लिखा होता है। जब यह PIN कोड तक नहीं पहुँचता, तो अगला कूरियर उसी कीमत पर उसकी जगह लेता है।',
      price: 'शामिल कूरियर के लिए ग्राहक कितना देता है?',
      priceHelp: 'दूसरे कूरियर इतने और अपने अंतर के बराबर होते हैं। Express की अपनी कीमत रहती है।',
    },
    chips: {
      speeds: { standard: 'Surface', express: 'Air', any: 'कोई भी स्पीड' },
      toggle: (name: string) => `ग्राहक ${name} चुन सकते हैं`,
      loading: 'आपके जुड़े कूरियर ढूँढ रहे हैं…',
      none: 'अभी किसी जुड़े कूरियर ने जवाब नहीं दिया। कूरियर ऐप जोड़ें, या एक मिनट में फिर कोशिश करें।',
      notConnected: 'जुड़ा नहीं',
      retry: 'फिर कोशिश करें',
      search: 'कूरियर खोजें',
      add: 'कूरियर जोड़ें',
      noMatch: 'कोई कूरियर नहीं मिला',
      remove: (name: string) => `${name} हटाएँ`,
    },
    included: {
      cheapest: 'सबसे सस्ता',
      recommended: 'सुझाया गया',
      onlyThis: 'सिर्फ़ यही, बाकी छिपाएँ',
      onlyThisHelp:
        'ग्राहकों को कोई और कूरियर नहीं दिखता। जहाँ यह डिलीवर नहीं करता, वहाँ बाकी टिक किए कूरियर लगते हैं।',
      pickFirst: 'इसे शामिल कूरियर बनाने के लिए ऊपर एक कूरियर चुनें।',
    },
    price: {
      option: 'सामान्य डिलीवरी कीमत',
      optionHelp: 'डिलीवरी विकल्प आज जो लेता है।',
      free: 'मुफ़्त',
      fixed: 'तय कीमत',
      fixedLabel: 'तय कीमत, रुपये में',
      freeAbove: 'इससे ऊपर मुफ़्त',
      freeAboveLabel: 'इस कार्ट वैल्यू से ऊपर मुफ़्त, रुपये में',
      freeAboveHelp: 'छूट के बाद की कार्ट वैल्यू।',
      courierPrices: 'कुछ कूरियर के लिए अलग कीमत',
      courierPricesHelp: 'ऊपर वाली कीमत लगाने के लिए कूरियर खाली छोड़ें।',
      courierPriceLabel: (courier: string) => `${courier} की कीमत, रुपये में`,
      packing: 'पैकिंग चार्ज',
      packingLabel: 'पैकिंग चार्ज, रुपये में',
      packingHelp: 'इन प्रोडक्ट की डिलीवरी कीमत में जुड़ता है, जैसे डिब्बे में पैक स्विच के लिए।',
      errors: {
        fixed: 'कीमत लिखें।',
        freeAbove: 'कार्ट वैल्यू लिखें।',
        courierFixed: 'रुपये में कीमत लिखें, या खाली छोड़ें।',
        packing: 'रुपये में पैकिंग चार्ज लिखें, या खाली छोड़ें।',
      },
    },
    more: {
      through: 'किसके ज़रिए',
    },
    sample: {
      title: 'ग्राहक यह देखेंगे',
      example: 'उदाहरण: यहाँ कूरियर की लागत बनावटी है, सिर्फ़ यह दिखाने के लिए कि नियम कीमत कैसे लगाता है।',
      free: 'मुफ़्त',
      recommended: 'सुझाया गया',
      extra: (amount: string) => `+ ${amount}`,
      total: (total: string, extra: string) => `${total} (+ ${extra})`,
      freeAbove: (amount: string) => `${amount} या उससे ज़्यादा के कार्ट पर मुफ़्त।`,
      packing: (amount: string) => `कीमतों में ${amount} पैकिंग शामिल है।`,
      express: 'Express, अगर आप देते हैं, तो उसकी अपनी कीमत रहती है।',
      empty: 'उदाहरण देखने के लिए एक कूरियर टिक करें।',
    },
    suggestions: {
      title: 'आपके शिपिंग रेट से सुझाव',
      help: 'सेटिंग्स → शिपिंग रेट से। नियम सेव करने तक कुछ नहीं बदलता।',
      add: 'नियम जोड़ें',
      products: (n: number) => `${n} प्रोडक्ट`,
      allProducts: 'सभी प्रोडक्ट',
      rates: (low: string, high: string) => (low === high ? low : `${low} – ${high}`),
      price: {
        free: 'मुफ़्त',
        fixed: (amount: string) => `तय ${amount}`,
        option: 'सामान्य कीमत',
        freeAbove: (amount: string) => `${amount} से ऊपर मुफ़्त`,
        courier: (courier: string, amount: string) => `${courier} ${amount}`,
        packing: (amount: string) => `+ ${amount} पैकिंग`,
      },
    },
    order: {
      title: 'नियमों का क्रम',
      sort: 'सबसे ख़ास पहले लगाएँ',
      sorted: 'नियम क्रम में लग गए।',
      moveAbove: (specific: string, broad: string) => `${specific} को ${broad} के ऊपर`,
      why: 'कम प्रोडक्ट वाला नियम बड़े नियम के ऊपर होना चाहिए, ताकि सूची उसी क्रम में पढ़ी जाए जिसमें चेकआउट इन्हें लगाता है।',
      kinds: {
        products: 'प्रोडक्ट',
        collections: 'एक कलेक्शन',
        tags: 'एक टैग',
        types: 'एक प्रोडक्ट टाइप',
        all: 'सभी प्रोडक्ट',
      },
      named: (name: string, kind: string) => `${name} (${kind})`,
      warnings: {
        title: 'जाँचने लायक नियम',
        oneCourier: (name: string, courier: string) =>
          `${name} सिर्फ़ ${courier} की अनुमति देता है: ग्राहकों के पास कोई विकल्प नहीं, और जहाँ ${courier} नहीं जाता वहाँ ये प्रोडक्ट डिलीवर नहीं हो सकते।`,
        allOneCourier: (name: string, courier: string) =>
          `${name} सभी प्रोडक्ट के लिए है और सिर्फ़ ${courier} की अनुमति देता है: जहाँ ${courier} नहीं जाता वहाँ कोई ऑर्डर डिलीवर नहीं हो सकता।`,
        separateParcels: (rule: string, other: string) =>
          `${rule} और ${other} में कोई कूरियर साझा नहीं है: दोनों वाला कार्ट अलग-अलग पार्सल में जाता है, हर पार्सल का अपना कूरियर और शिपिंग चार्ज।`,
        twin: (rule: string, ruled: string, other: string, n: number) =>
          `${rule} कलेक्शन “${ruled}” का नाम लेता है पर “${other}” का नहीं: वहाँ के ${n} प्रोडक्ट नियम नहीं मानते।`,
      },
    },
  }),
]
