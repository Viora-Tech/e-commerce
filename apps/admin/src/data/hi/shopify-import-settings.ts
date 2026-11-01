import { shopifyImportSettingsContent } from '@/data/shopify-import-settings'
import { translation } from '@/lib/i18n'

const num = (n: number) => n.toLocaleString('en-IN')

export default [
  translation(shopifyImportSettingsContent, {
    card: {
      title: 'स्टोर सेटिंग',
      body: 'अपने स्टोर की जानकारी, टैक्स, लोकेशन, शिपिंग रेट, पॉलिसी और एक्स्ट्रा फ़ील्ड यहाँ लाएं। हर बदलाव होने से पहले देखें।',
      action: 'सेटिंग जाँचें',
    },
    intro:
      'अपने Shopify स्टोर का सेटअप यहाँ लाएं: स्टोर की जानकारी, टैक्स, लोकेशन, शिपिंग रेट, पॉलिसी और एक्स्ट्रा फ़ील्ड। पहले जाँचें कि ठीक-ठीक क्या बदलेगा। इंपोर्ट दबाने तक कुछ नहीं बदलता।',
    notConnected: 'पहले अपना Shopify स्टोर जोड़ें, फिर यहाँ वापस आएं।',
    connect: 'Shopify जोड़ें',
    check: 'Shopify जाँचें',
    checkAgain: 'फिर से जाँचें',
    checkFailed: 'आपका Shopify स्टोर पढ़ा नहीं जा सका',
    comparing: (shop) => `${shop} से मिलान किया`,
    choose: 'चुनें कि क्या लाना है। जो हिस्से पहले से मेल खाते हैं या जिन्हें एक्सेस चाहिए, उन्हें चुना नहीं जा सकता।',
    import: (n) => (n === 0 ? 'इंपोर्ट करें' : `${num(n)} हिस्से इंपोर्ट करें`),
    importFailed: 'इंपोर्ट पूरा नहीं हुआ',
    imported: 'स्टोर सेटिंग इंपोर्ट हो गईं',
    reportHeading: 'क्या हुआ',
    reportIntro: 'हर हिस्सा अलग से सेव हुआ। इसे दोबारा चलाना सुरक्षित है: जो पहले से यहाँ है वह मेल खाता दिखेगा।',
    backToCheck: 'फिर से जाँचें',
    openSettings: 'सेटिंग खोलें',
    reconnect: (scopes) =>
      `Shopify ने इंपोर्टर को यह पढ़ने नहीं दिया। Shopify में अपने ऐप में ${scopes} जोड़ें, फिर दोबारा जोड़ें।`,
    reconnectAction: 'दोबारा जोड़ें',
    showAll: (n) => `सभी ${num(n)} देखें`,
    showLess: 'कम दिखाएं',
    on: 'चालू',
    off: 'बंद',
    parts: {
      store: {
        title: 'स्टोर की जानकारी',
        body: 'स्टोर का नाम, संपर्क ईमेल और फ़ोन, बिज़नेस का पता। करेंसी, टाइम ज़ोन और वज़न की इकाई सिर्फ़ मिलाई जाती है, कभी बदली नहीं जाती।',
      },
      tax: {
        title: 'टैक्स और GST',
        body: 'आपकी कीमतों में टैक्स शामिल है या नहीं, और Shopify बताए तो आपका GST नंबर। यहाँ पहले से मौजूद GST नंबर कभी नहीं बदला जाता।',
      },
      locations: {
        title: 'लोकेशन',
        body: 'आपकी Shopify लोकेशन उनके पते और PIN कोड के साथ, नाम से मिलाकर। नई लोकेशन में कोई स्टॉक नहीं होता और जब तक आप चालू न करें, वे ऑनलाइन नहीं बेचतीं।',
      },
      shipping: {
        title: 'शिपिंग ज़ोन और रेट',
        body: 'आपकी जनरल शिपिंग प्रोफ़ाइल के ज़ोन और रेट: फ़्लैट, ऑर्डर की रकम से, वज़न से, और किसी रकम से ऊपर फ़्री।',
      },
      packages: {
        title: 'पैकेज',
        body: 'शिपमेंट बनाते समय इस्तेमाल होने वाले सेव किए हुए बॉक्स साइज़।',
      },
      policies: {
        title: 'पॉलिसी',
        body: 'रिफ़ंड, प्राइवेसी, सेवा की शर्तें, शिपिंग और संपर्क पॉलिसी, स्क्रिप्ट और स्टाइलिंग हटाकर।',
      },
      fields: {
        title: 'एक्स्ट्रा फ़ील्ड',
        body: 'प्रोडक्ट, वेरिएंट, कलेक्शन, ग्राहक और ऑर्डर के एक्स्ट्रा फ़ील्ड, जहाँ वह फ़ील्ड टाइप यहाँ मौजूद है।',
      },
      segments: {
        title: 'ग्राहक सेगमेंट',
        body: 'आपके सेव किए ग्राहक ग्रुप, उनके नियमों से दोबारा बने: टैग, ऑर्डर, खर्च, ईमेल सब्सक्रिप्शन और आख़िरी ऑर्डर। दूसरे फ़िल्टर वाले यहाँ बनाने के लिए दिखाए जाते हैं।',
      },
      markets: {
        title: 'मार्केट',
        body: 'दूसरे देशों के आपके मार्केट, उनकी करेंसी, भाषा, सबफ़ोल्डर और कीमत में बदलाव के साथ। Shopify के ड्राफ़्ट यहाँ बंद आते हैं। भारत आपका मुख्य मार्केट रहता है।',
      },
      purchase_orders: {
        title: 'परचेज़ ऑर्डर',
        body: 'रुपये में आपके परचेज़ ऑर्डर, सप्लायर, डेस्टिनेशन और प्रोडक्ट के साथ। सप्लायर नाम से मिलाए या जोड़े जाते हैं। जो अभी ऑर्डर पर है वह आने वाले स्टॉक में दिखता है; आपका मौजूदा स्टॉक नहीं बदलता। पहले प्रोडक्ट इंपोर्ट करें।',
      },
      transfers: {
        title: 'ट्रांसफ़र',
        body: 'आपकी लोकेशन के बीच स्टॉक की आवाजाही, ड्राफ़्ट, रास्ते में या पहुँच चुकी। आपका मौजूदा स्टॉक नहीं बदलता; रास्ते के यूनिट डेस्टिनेशन पर आने वाले स्टॉक में दिखते हैं। पहले प्रोडक्ट इंपोर्ट करें।',
      },
    },
    state: {
      ready: 'लाने लायक बदलाव',
      same: 'पहले से मेल खाता है',
      access: 'एक्सेस चाहिए',
      failed: 'पढ़ा नहीं जा सका',
    },
    result: {
      done: 'सेव हुआ',
      same: 'बदलने को कुछ नहीं',
      access: 'एक्सेस चाहिए',
      failed: 'सेव नहीं हुआ',
      skipped: 'चुना नहीं गया',
    },
    saved: (n) => `${num(n)} बदलाव सेव हुए`,
    actions: {
      create: 'नया',
      update: 'बदलाव',
      same: 'मेल खाता है',
      conflict: 'आपका रखा',
      manual: 'खुद सेट करें',
      warn: 'नोट',
    },
    subjects: {
      store_name: 'स्टोर का नाम',
      contact_email: 'संपर्क ईमेल',
      contact_phone: 'संपर्क फ़ोन',
      address: 'बिज़नेस का पता',
      default_location_address: 'डिफ़ॉल्ट लोकेशन का पता',
      currency: 'करेंसी',
      timezone: 'टाइम ज़ोन',
      weight_unit: 'वज़न की इकाई',
      money_format: 'कीमत का फ़ॉर्मेट',
      home_seo_title: 'होम पेज का टाइटल (सर्च रिज़ल्ट)',
      home_seo_description: 'होम पेज का विवरण (सर्च रिज़ल्ट)',
      prices_include_tax: 'कीमतों में टैक्स शामिल',
      gstin: 'GST नंबर',
      location: 'लोकेशन',
      shipping_zone: 'शिपिंग ज़ोन',
      delivery_profile: 'शिपिंग प्रोफ़ाइल',
      packages: 'पैकेज',
      policy: 'पॉलिसी',
      field: 'एक्स्ट्रा फ़ील्ड',
      segment: 'ग्राहक सेगमेंट',
      market: 'मार्केट',
      purchase_order: 'परचेज़ ऑर्डर',
      transfer: 'ट्रांसफ़र',
    },
    owners: {
      product: 'प्रोडक्ट',
      variant: 'वेरिएंट',
      collection: 'कलेक्शन',
      customer: 'ग्राहक',
      order: 'ऑर्डर',
    },
    empty: 'इस हिस्से के लिए Shopify में कुछ नहीं है।',
    rates: {
      flat: (price) => `${price} फ़्लैट`,
      free: 'फ़्री',
      orderValue: (price, from, to) => `${from} से ${to} के ऑर्डर पर ${price}`,
      orderOver: (price, from) => `${from} से ऊपर के ऑर्डर पर ${price}`,
      orderUnder: (price, to) => `${to} से कम के ऑर्डर पर ${price}`,
      weight: (price, from, to) => `${from} से ${to} तक ${price}`,
      weightOver: (price, from) => `${from} से ऊपर ${price}`,
      weightUnder: (price, to) => `${to} से कम ${price}`,
      grams: (g) => `${g} ग्राम`,
    },
    reasons: {
      currency_mismatch: (v) =>
        `Shopify ${v.to} में बेचता है, यह स्टोर ${v.from} में। कीमतें बदली नहीं जातीं।`,
      timezone_mismatch: (v) =>
        `Shopify ${v.to} इस्तेमाल करता है, यह स्टोर ${v.from}। एक जैसा चाहिए तो Settings › General में बदलें।`,
      weight_unit: (v) =>
        `Shopify ${v.detail.toLowerCase()} में वज़न रखता है। यहाँ वज़न ग्राम में है; इंपोर्ट हुए प्रोडक्ट बदल दिए गए थे।`,
      gstin_not_shared: () =>
        'Shopify आपका GST नंबर ऐप्स को नहीं देता। इसे Settings › Taxes & GST में जोड़ें।',
      gstin_exists: (v) =>
        `इस स्टोर में पहले से ${v.from} है। Shopify का ${v.to} नहीं जोड़ा गया। GST नंबर Settings › Taxes & GST में बदलें।`,
      invalid_email: (v) => `${v.detail} सही ईमेल नहीं है, इसलिए छोड़ दिया गया।`,
      invalid_phone: (v) => `${v.detail} सही फ़ोन नंबर नहीं है, इसलिए छोड़ दिया गया।`,
      invalid_pincode: (v) => `${v.detail} 6 अंकों का PIN कोड नहीं है। पता उसके बिना आया।`,
      default_location: (v) =>
        `Shopify पर ${v.name} से पहले शिप होता है। आपकी डिफ़ॉल्ट लोकेशन ${v.detail} ही रहेगी; Settings › Locations में बदलें।`,
      app_location: (v) => `Shopify पर ${v.name} किसी ऐप से चलती है, इसलिए नहीं जोड़ी गई।`,
      local_pickup: (v) => `${v.name} पर स्टोर से पिकअप अभी यहाँ उपलब्ध नहीं है।`,
      zone_outside_india: (v) =>
        `${v.name} भारत के बाहर शिप करता है। यहाँ रेट सिर्फ़ भारतीय पतों के लिए हैं।`,
      zone_other_countries: (v) =>
        `${v.name} में दूसरे देश (${v.detail}) भी हैं। सिर्फ़ इसका भारतीय हिस्सा आया।`,
      zone_no_rates: (v) => `${v.name} का कोई रेट लाया नहीं जा सका, इसलिए यह नहीं बना।`,
      unknown_state: (v) => `${v.name} में ${v.detail} यहाँ कोई भारतीय राज्य नहीं है।`,
      profile_products_missing: (v) =>
        `${v.name} के ${v.detail} प्रोडक्ट अभी इंपोर्ट नहीं हुए। पहले प्रोडक्ट इंपोर्ट करें, फिर उन्हें जोड़ने के लिए सेटिंग्स दोबारा इंपोर्ट करें।`,
      carrier_rates: (v) =>
        `${v.name} का रेट ${v.detail || 'कैरियर'} लाइव निकालता है। इसकी जगह यहाँ कोई कूरियर जोड़ें।`,
      mixed_conditions: (v) =>
        `${v.name} ऑर्डर की रकम और वज़न दोनों पर निर्भर है। यहाँ रेट इनमें से एक पर चलते हैं।`,
      rate_currency: (v) => `${v.name} की कीमत ${v.detail} में है।`,
      packages_not_shared: () =>
        'Shopify सेव किए पैकेज ऐप्स को नहीं देता। अपने बॉक्स और लिफ़ाफ़े Settings › Shipping › Packages में जोड़ें।',
      policy_type: (v) => `${v.name} के लिए यहाँ कोई पेज नहीं है। ज़रूरत हो तो इसे किसी पेज में कॉपी करें।`,
      policy_images: (v) => `${v.name} की ${num(Number(v.detail) || 0)} फ़ोटो छोड़ दी गईं।`,
      field_type: (v) => `${v.name} एक ${v.detail} फ़ील्ड है, जिसका यहाँ कोई मेल नहीं है।`,
      reference_target: (v) =>
        `${v.name} ऐसे कंटेंट टाइप से जुड़ा है जो अभी इंपोर्ट नहीं हुआ। कंटेंट टाइप इंपोर्ट करें, फिर दोबारा जाँचें।`,
      field_exists: (v) => `${v.name} यहाँ पहले से दूसरे टाइप में है, इसलिए आपका रखा गया।`,
      owner_access: (v) => `${v.name} के एक्स्ट्रा फ़ील्ड पढ़े नहीं जा सके: ${v.detail}`,
      segment_rule: (v) =>
        `${v.name} में ऐसा फ़िल्टर है जो यहाँ नहीं है (${v.detail})। इसे Customers › Segments में बनाएँ।`,
      market_countries: (v) =>
        `${v.name} में कोई जाना-पहचाना देश नहीं है, इसलिए नहीं लाया गया। इसे Markets में बनाएँ।`,
      market_country_taken: (v) =>
        `${v.detail} पहले से यहाँ के दूसरे मार्केट में है, इसलिए ${v.name} नहीं लाया गया। इसे Markets में बदलें।`,
      stock_products_missing: (v) =>
        `${v.name} में ${v.detail} प्रोडक्ट अभी यहाँ इंपोर्ट नहीं हुए। प्रोडक्ट इंपोर्ट करें, फिर दोबारा जाँचें।`,
      stock_location_missing: (v) =>
        `${v.name} की लोकेशन ${v.detail || '(Shopify पर डिलीट)'} यहाँ नहीं है। Locations लाएँ, फिर दोबारा जाँचें।`,
      po_currency: (v) =>
        `${v.name} ${v.detail} में है और Shopify एक्सचेंज रेट नहीं देता। इसे Purchase orders में बनाएँ।`,
      po_receipts: (v) =>
        `${v.name} का कुछ हिस्सा Shopify पर पहले ही आ चुका है, और वह स्टॉक प्रोडक्ट के साथ आ गया। सिर्फ़ बाकी माल रिसीव करें।`,
      transfer_status: (v) => `${v.name} Shopify पर ${v.detail} है, इसलिए नहीं लाया गया।`,
      transfer_origin: (v) =>
        `${v.name} की भेजने वाली लोकेशन नहीं है (परचेज़ ऑर्डर की रसीद), इसलिए नहीं लाया गया।`,
    },
    fixHref: {
      store: '/settings/store',
      tax: '/settings/taxes',
      locations: '/settings/locations',
      shipping: '/settings/shipping',
      packages: '/settings/shipping',
      policies: '/settings/policies',
      fields: '/settings/custom-data',
      segments: '/customers/segments',
      markets: '/markets',
      purchase_orders: '/stock/purchase-orders',
      transfers: '/stock/transfers',
    },
  }),
]
