import { siteConfig } from '@commerce/config/site'
import { SCOPE_LIST, shopifyImportContent } from '@/data/shopify-import'
import { type Translation, translation } from '@/lib/i18n'

const num = (n: number) => n.toLocaleString('en-IN')

/**
 * The whole importer copy, registered once as a whole and once per section, so a component
 * can call `useCopy(shopifyImportContent.run)` directly in its hooks.
 */
const hi = {
  base: '/apps/shopify-import',
  resources: {
    products: 'प्रोडक्ट',
    collections: 'कलेक्शन',
    customers: 'ग्राहक',
    orders: 'ऑर्डर',
    pages: 'पेज',
    articles: 'ब्लॉग पोस्ट',
    menus: 'मेन्यू',
    redirects: 'URL रीडायरेक्ट',
    files: 'फ़ाइलें',
    metaobjects: 'कंटेंट टाइप और एंट्री',
    metafields: 'एक्स्ट्रा फ़ील्ड',
    discounts: 'डिस्काउंट',
    gift_cards: 'गिफ़्ट कार्ड',
  },
  previewReady: 'प्रीव्यू तैयार',
  status: {
    queued: 'लाइन में',
    running: 'चल रहा है',
    completed: 'पूरा हुआ',
    failed: 'रुक गया',
    cancelled: 'रोका गया',
  },

  home: {
    title: 'Shopify से इंपोर्ट करें',
    subtitle:
      'अपने प्रोडक्ट, ग्राहक और पुराने ऑर्डर यहाँ ले आएं। हर इंपोर्ट पहले प्रीव्यू होता है और दोबारा चलाना सुरक्षित है।',
    csvTitle: 'CSV फ़ाइलें अपलोड करें',
    csvBody:
      'अपने Shopify एडमिन से Products, Customers और Orders के एक्सपोर्ट इस्तेमाल करें। पहली बार देखने या छोटे स्टोर के लिए अच्छा है।',
    csvAction: 'फ़ाइल अपलोड करें',
    apiTitle: 'अपना Shopify स्टोर जोड़ें',
    apiBody:
      'एक Shopify ऐप (या पहले से बना Admin API टोकन) जोड़ें और सब कुछ ले आएं: कलेक्शन, पेज, ब्लॉग पोस्ट, मेन्यू, रीडायरेक्ट, फ़ाइलें, कंटेंट टाइप, एक्स्ट्रा फ़ील्ड, डिस्काउंट और गिफ़्ट कार्ड भी।',
    apiAction: 'स्टोर जोड़ें',
    apiConnected: (shop) => `${shop} से जुड़ा है`,
    historyTitle: 'इंपोर्ट का इतिहास',
    columns: {
      started: 'शुरू हुआ',
      source: 'कहाँ से',
      what: 'क्या इंपोर्ट हुआ',
      status: 'स्थिति',
      result: 'नतीजा',
    },
    source: { csv: (file) => file ?? 'CSV फ़ाइल', api: 'Shopify स्टोर' },
    failedNoReason: 'पूरा होने से पहले रुक गया। वजह देखने के लिए खोलें।',
    progress: (processed, total) =>
      total > 0 ? `अब तक ${num(total)} में से ${num(processed)}` : 'शुरू हो रहा है…',
    loadFailed: 'इंपोर्ट का इतिहास नहीं मिल पाया। दोबारा कोशिश हो रही है…',
    preview: 'प्रीव्यू',
    empty: {
      heading: 'अभी कोई इंपोर्ट नहीं',
      body: 'Shopify की CSV अपलोड करें या अपना स्टोर जोड़ें। कुछ भी लिखने से पहले आप देखेंगे कि क्या बदलेगा।',
    },
    result: (created, updated, failed) =>
      [
        created ? `${num(created)} नए` : null,
        updated ? `${num(updated)} अपडेट` : null,
        failed ? `${num(failed)} नहीं हो पाए` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'इंपोर्ट करने को कुछ नहीं',
  },

  csv: {
    kindHeading: 'फ़ाइल में क्या है?',
    kinds: {
      products: {
        label: 'प्रोडक्ट',
        short: 'आइटम, वेरिएंट, कीमत और स्टॉक',
        help: 'Shopify एडमिन में Products, Export, "All products", Excel वाली CSV या सादी CSV। वेरिएंट, कीमत, स्टॉक, फ़ोटो, SEO और HSN वाला कॉलम पढ़ा जाता है।',
      },
      customers: {
        label: 'ग्राहक',
        short: 'लोग, पते और सहमति',
        help: 'Shopify एडमिन में Customers, Export। पते, ईमेल मार्केटिंग की सहमति, नोट और टैग पढ़े जाते हैं; ग्राहक ईमेल से मिलाए जाते हैं।',
      },
      orders: {
        label: 'ऑर्डर',
        short: 'पुराने ऑर्डर, इतिहास की तरह',
        help: 'Shopify एडमिन में Orders, Export। ऑर्डर सिर्फ़ पढ़ने वाले इतिहास की तरह आते हैं: स्टॉक नहीं बदलता, मैसेज नहीं जाते, इनवॉइस नहीं बनते।',
      },
    },
    fileHeading: 'फ़ाइल',
    dropTitle: 'CSV फ़ाइल यहाँ खींचकर छोड़ें',
    dropBrowse: 'या अपने कंप्यूटर से फ़ाइल चुनें',
    dropActive: 'फ़ाइल चुनने के लिए यहाँ छोड़ें',
    dropReplace: 'दूसरी फ़ाइल छोड़ें या चुनें, यह बदल जाएगी',
    maxSize: 'एक .csv फ़ाइल, 15 MB तक',
    previewHint: 'आगे बढ़ने के लिए फ़ाइल चुनें',
    howTo: {
      heading: 'Shopify से एक्सपोर्ट कैसे करें',
      steps: [
        'अपने Shopify एडमिन में Products, Customers या Orders खोलें।',
        'Export दबाएं और सारे आइटम सादी CSV फ़ाइल में चुनें।',
        'मिली हुई फ़ाइल को बाईं ओर के बॉक्स में खींचकर छोड़ें।',
      ],
      moreFor: (what) => `${what} से क्या पढ़ा जाता है`,
    },
    size: (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`,
    tooBig: 'यह फ़ाइल 15 MB से बड़ी है। इसे बाँटें, या अपना स्टोर जोड़ें।',
    notCsv: 'Shopify से एक्सपोर्ट की गई .csv फ़ाइल चुनें।',
    preview: 'इंपोर्ट का प्रीव्यू देखें',
    failed: 'फ़ाइल अपलोड नहीं हो पाई',
  },

  connect: {
    headerConnect: 'Shopify स्टोर जोड़ें',
    headerEdit: 'कनेक्शन बदलें',
    mode: {
      install: `${siteConfig.brand.name} ऐप इंस्टॉल करें`,
      app: 'अपने Shopify ऐप से जोड़ें',
      token: 'मेरे पास पहले से Admin API टोकन है',
    },
    app: {
      badge: 'सुझाया गया',
      intro:
        'Shopify ने 1 जनवरी 2026 से एडमिन में नए कस्टम ऐप बनाना बंद कर दिया है। अब ऐप Dev Dashboard में बनते हैं, इसमें करीब पाँच मिनट लगते हैं।',
      stepsHeading: 'Dev Dashboard में ऐप बनाएं',
      steps: [
        {
          text: 'Shopify Dev Dashboard खोलें और एक ऐप बनाएं।',
          link: { label: 'Dev Dashboard खोलें', href: 'https://dev.shopify.com/dashboard' },
        },
        { text: 'Configuration में Admin API को ये read scopes दें।', scopes: true },
        { text: 'ऐप का एक वर्ज़न रिलीज़ करें।' },
        { text: 'Dev Dashboard से ऐप को अपने स्टोर पर इंस्टॉल करें।' },
        {
          text: 'ऐप के API credentials पेज से client ID और client secret कॉपी करें और फ़ॉर्म में पेस्ट करें।',
        },
      ],
      scopesLabel: 'Admin API scopes',
      copyScopes: 'सारे scopes कॉपी करें',
      scopesCopied: 'Scopes कॉपी हो गए',
      formHeading: 'आपके ऐप की जानकारी',
      docsLink:
        'https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant',
      docsLabel: 'client credentials grant कैसे काम करता है',
      clientId: 'Client ID',
      clientIdPlaceholder: 'client ID पेस्ट करें',
      clientSecret: 'Client secret',
      clientSecretPlaceholder: 'client secret पेस्ट करें',
      clientSecretHelp:
        'एन्क्रिप्ट करके रखा जाता है। हम इसके बदले एक टोकन लेते हैं जिसे Shopify 24 घंटे में खत्म कर देता है, और उसे अपने आप नया करते रहते हैं।',
      submit: 'जोड़ें',
      oauthNote: `खुद ऐप नहीं बनाना? ऊपर दिखे तो ${siteConfig.brand.name} ऐप इंस्टॉल करें चुनें।`,
    },
    token: {
      stepsHeading: 'Shopify में टोकन बनाएं',
      steps: [
        'अपने Shopify एडमिन में Settings, Apps and sales channels, Develop apps खोलें और एक ऐप बनाएं। (1 जनवरी 2026 के बाद नया स्टोर है? Shopify अब यहाँ यह नहीं करने देता, ऐप वाला तरीका अपनाएं।)',
        `Configuration में Admin API को ये read scopes दें: ${SCOPE_LIST}।`,
        'ऐप इंस्टॉल करें, फिर Admin API access token एक बार दिखाएं और यहाँ पेस्ट करें।',
      ],
      domain: 'स्टोर का पता',
      domainPlaceholder: 'your-store.myshopify.com',
      token: 'Admin API access token',
      tokenPlaceholder: 'shpat_...',
      tokenHelp: 'shpat_ से शुरू होता है। सिर्फ़ read scopes काफ़ी हैं।',
      submit: 'जोड़ें',
    },
    domain: 'स्टोर का पता',
    domainPlaceholder: 'your-store.myshopify.com',
    connected: 'स्टोर जुड़ गया',
    connectFailed: 'जोड़ नहीं पाए',
    connection: 'कनेक्शन',
    shop: 'स्टोर',
    tokenLabel: 'जानकारी',
    authMode: {
      legacy: 'Admin API टोकन',
      client_credentials: 'Shopify ऐप (Dev Dashboard)',
      app: `Shopify पर ${siteConfig.brand.name} ऐप`,
    },
    verified: 'जाँचा गया',
    disconnect: 'हटाएं',
    change: 'बदलें',
    changeIntro: 'नई जानकारी से फिर जोड़ें। नया कनेक्शन जाँचे जाने तक मौजूदा कनेक्शन चलता रहेगा।',
    cancelChange: 'रद्द करें',
    disconnected: 'स्टोर हटा दिया',
    testHeading: 'कनेक्शन जाँचें',
    test: 'कनेक्शन जाँचें',
    testFailed: 'कनेक्शन जाँच नहीं पाए',
    scopesGranted: 'मिली हुई',
    scopesMissing: 'नहीं मिली',
    scopesAllGranted: 'इस इंपोर्ट को जो भी scope चाहिए, सब मिले हुए हैं।',
    scopeNames: {
      read_products: 'प्रोडक्ट पढ़ना',
      read_inventory: 'इन्वेंटरी पढ़ना',
      read_customers: 'ग्राहक पढ़ना',
      read_orders: 'ऑर्डर पढ़ना',
      read_all_orders: '60 दिन से पुराने ऑर्डर पढ़ना',
      read_content: 'पेज और ब्लॉग पोस्ट पढ़ना',
      read_online_store_navigation: 'मेन्यू और रीडायरेक्ट पढ़ना',
      read_files: 'फ़ाइलें पढ़ना',
      read_metaobject_definitions: 'कंटेंट टाइप पढ़ना',
      read_metaobjects: 'एंट्री पढ़ना',
      read_discounts: 'डिस्काउंट पढ़ना',
      read_gift_cards: 'गिफ़्ट कार्ड पढ़ना',
      read_shipping: 'शिपिंग ज़ोन और रेट पढ़ना',
      read_legal_policies: 'स्टोर पॉलिसी पढ़ना',
      read_purchase_options: 'प्री-ऑर्डर (परचेज़ ऑप्शन) पढ़ना',
      read_markets: 'मार्केट पढ़ना',
    },
    chooseHeading: 'क्या इंपोर्ट करना है',
    chooseHelp: 'प्रोडक्ट पहले आते हैं ताकि कलेक्शन, ऑर्डर, डिस्काउंट और एक्स्ट्रा फ़ील्ड उनसे जुड़ सकें।',
    scope: (s) => `चाहिए: ${s}`,
    unusedFiles: 'बिना इस्तेमाल वाली फ़ाइलें भी इंपोर्ट करें',
    unusedFilesHelp:
      'अपने आप सिर्फ़ वही फ़ोटो और वीडियो आते हैं जो आपके प्रोडक्ट, कलेक्शन, पेज और लेख में इस्तेमाल हैं। Shopify Files की सारी फ़ाइलें चाहिए तो इसे चुनें।',
    preview: 'इंपोर्ट का प्रीव्यू देखें',
    previewFailed: 'प्रीव्यू शुरू नहीं हो पाया',
  },

  run: {
    back: 'इंपोर्ट',
    title: (preview) => (preview ? 'इंपोर्ट का प्रीव्यू' : 'इंपोर्ट'),
    from: (source) => `${source} से`,
    waiting: 'बैकग्राउंड में शुरू होने का इंतज़ार है।',
    running: 'आपका डेटा लाया जा रहा है। आप यह पेज छोड़ सकते हैं, काम चलता रहेगा।',
    previewDone: 'अभी कुछ नहीं लिखा गया। नीचे गिनती और दिक्कतें देखें, फिर इंपोर्ट करें।',
    previewReuse:
      'अभी इंपोर्ट करें दबाने पर यह प्रीव्यू जो डेटा Shopify से ला चुका है वही इस्तेमाल होगा, और Shopify से सिर्फ़ उसके बाद हुए बदलाव मँगाए जाएँगे। इंतज़ार बचाने के लिए एक दिन के अंदर इंपोर्ट करें।',
    usingPreview: (when, changes) =>
      `${when} का प्रीव्यू इस्तेमाल हो रहा है + उसके बाद के ${num(changes)} बदलाव।`,
    importDone: 'इंपोर्ट पूरा हुआ। दोबारा चलाने पर बना हुआ डेटा अपडेट होता है, डबल नहीं बनता।',
    failed: 'इंपोर्ट रुक गया।',
    stopped: (who, when) => (who ? `${who} ने ${when} पर रोका।` : `${when} पर रोका गया।`),
    stoppedKeeps:
      'जो इंपोर्ट हो चुका है वह यहीं रहेगा। बाकी को “फिर से चलाएं” या “छूटे हुए फिर से इंपोर्ट करें” से लाएँ।',
    stopping: 'रोका जा रहा है… इंपोर्ट कुछ ही सेकंड में रुक जाएगा।',
    stop: {
      button: 'इंपोर्ट रोकें',
      title: 'यह इंपोर्ट रोकें?',
      body: 'जो इंपोर्ट हो चुका है वह यहीं रहेगा। बाकी बाद में “फिर से चलाएं” या “फिर से इंपोर्ट करें” से ला सकते हैं।',
      confirm: 'इंपोर्ट रोकें',
      keep: 'इंपोर्ट चलने दें',
      done: 'इंपोर्ट रोक दिया',
      asked: 'इंपोर्ट रोका जा रहा है',
      failed: 'इंपोर्ट रोका नहीं जा सका',
    },
    importNow: 'अभी इंपोर्ट करें',
    runAgain: 'फिर से चलाएं',
    tryAgain: 'फिर कोशिश करें',
    started: 'इंपोर्ट शुरू हुआ',
    startFailed: 'इंपोर्ट शुरू नहीं हो पाया',
    phase: {
      products: 'Shopify आपके प्रोडक्ट तैयार कर रहा है…',
      customers: 'Shopify आपके ग्राहक तैयार कर रहा है…',
      orders: 'Shopify आपके ऑर्डर तैयार कर रहा है…',
    },
    progressHeading: 'हर तरह की गिनती',
    columns: {
      what: 'क्या',
      progress: 'प्रगति',
      created: 'नए',
      updated: 'अपडेट',
      skipped: 'छोड़े गए',
      failed: 'नहीं हो पाए',
    },
    counted: (processed, total) => `${num(total)} में से ${num(processed)}`,
    sampleHeading: 'क्या बदलेगा, इसकी झलक',
    sampleAction: { create: 'नया', update: 'अपडेट', skip: 'छोड़ें' },
    issuesHeading: (n) => `${num(n)} दिक्कतें`,
    issuesNone: 'कोई दिक्कत नहीं मिली।',
    issueColumns: { where: 'कहाँ', what: 'रिकॉर्ड', message: 'दिक्कत' },
    line: (n) => `लाइन ${n}`,
    notFound: 'यह इंपोर्ट अब मौजूद नहीं है।',
    previous: 'पिछला पेज',
    next: 'अगला पेज',
    retryMissed: (n) => `जो ${num(n)} छूट गए, उन्हें फिर से इंपोर्ट करें`,
    retryFailed: 'दोबारा कोशिश शुरू नहीं हो पाई',
    importAll: 'सब कुछ फिर से इंपोर्ट करें',
    retrying: 'सिर्फ़ वही दोबारा लाया जा रहा है जो पिछले इंपोर्ट में छूट गया था। बाकी सब वैसा ही रहेगा।',
    remainingRun:
      'सिर्फ़ वही लाया जा रहा है जो अभी यहाँ नहीं है या पिछली बार किसी दिक्कत में अटका था। बाकी सब वैसा ही रहेगा।',
    now: (what, done, total) => `${what}: ${num(total)} में से ${num(done)}`,
    problems: {
      showAll: 'हर रिकॉर्ड देखें',
      showGrouped: 'वजह के हिसाब से देखें',
      unit: (n) => `${num(n)} रिकॉर्ड दोबारा लाने हैं: एक रिकॉर्ड में कई दिक्कतें हो सकती हैं, जैसे कई फ़ोटो।`,
      example: 'उदाहरण:',
      retryable: (n) => `${num(n)} रिकॉर्ड फिर से लाए जा सकते हैं`,
      retryableImages: (images, records) =>
        `${num(images)} फ़ोटो अपने ${num(records)} रिकॉर्ड के साथ फिर से लाई जा सकती हैं`,
      retryableFiles: (files, records) =>
        `${num(files)} फ़ाइलें फिर से लाई जा सकती हैं (${num(records)} रिकॉर्ड)`,
      fix: { storage: 'स्टोरेज जोड़ें', scope: 'अनुमति जोड़ें' },
      cause: {
        storage: (n) => `${num(n)} फ़ोटो और फ़ाइलें कॉपी नहीं हुईं: फ़ाइल स्टोरेज काम नहीं कर रहा`,
        scope: (n) => `${num(n)} तरह का डेटा Shopify ने पढ़ने नहीं दिया`,
        order_number: (n) => `${num(n)} ऑर्डर छोड़े गए: यह ऑर्डर नंबर यहाँ पहले से है`,
        image: (n) => `${num(n)} फ़ोटो कॉपी नहीं हो पाईं`,
        file: (n) => `${num(n)} फ़ाइलें कॉपी नहीं हो पाईं`,
        record: (n) => `${num(n)} रिकॉर्ड सेव नहीं हो पाए`,
        note: (n) => `${num(n)} नोट: क्या बदला या Shopify में रह गया`,
      },
    },
  },

  remaining: {
    heading: 'क्या इंपोर्ट होना बाकी है',
    subtitle: 'Shopify की गिनती और यहाँ की गिनती साथ-साथ, ताकि दिखे कि क्या अभी बाकी है।',
    notConnectedHeading: 'अभी मिलाने को कुछ नहीं',
    notConnected: 'क्या बाकी है यह देखने के लिए अपना Shopify स्टोर जोड़ें।',
    connectAction: 'अपना Shopify स्टोर जोड़ें',
    loadFailed: 'बाकी का हिसाब नहीं मिल पाया। पेज दोबारा खोलें।',
    columns: { what: 'क्या', inShopify: 'Shopify में', here: 'यहाँ', status: 'स्थिति' },
    state: {
      done: 'पूरा',
      missing: 'बाकी',
      not_copied: 'कॉपी नहीं हुआ',
      never: 'कभी इंपोर्ट नहीं हुआ',
      unknown: 'अभी जाँचा नहीं',
    },
    missingCount: (n) => `${num(n)} बाकी`,
    notCopiedCount: (n) => `${num(n)} कॉपी नहीं हुए`,
    images: 'प्रोडक्ट फ़ोटो',
    action: {
      import: (n) => `${num(n)} इंपोर्ट करें`,
      images: 'फ़ोटो कॉपी करें',
      files: 'फ़ाइलें कॉपी करें',
      preview: 'प्रीव्यू चलाएं',
    },
    importRemaining: 'बाकी इंपोर्ट करें',
    previewEverything: 'सबका प्रीव्यू देखें',
    previewStarted: 'प्रीव्यू शुरू हुआ',
    allHere: 'सब कुछ यहाँ है',
    fromShopify: 'Shopify से अभी गिना गया',
    fromImport: (when) => `${when} के पूरे इंपोर्ट ने गिना`,
    fromIssues: 'कम से कम इतने: जो यहाँ है और जो पिछला इंपोर्ट कॉपी नहीं कर पाया',
    fromPreview: (when) => `जो गिनती Shopify नहीं देता, वह ${when} के प्रीव्यू से है`,
    lastImport: (when) => `पिछला इंपोर्ट ${when}`,
    nothingYet: 'अभी कुछ इंपोर्ट नहीं हुआ',
    running: {
      import: 'एक इंपोर्ट चल रहा है। उसके पूरा होने पर ये गिनतियाँ बदलेंगी।',
      preview: 'एक प्रीव्यू चल रहा है। उसके पूरा होने पर ये गिनतियाँ बदलेंगी।',
      queued: 'एक इंपोर्ट शुरू होने का इंतज़ार कर रहा है। उसके पूरा होने पर ये गिनतियाँ बदलेंगी।',
      action: 'प्रगति देखें',
    },
    previewReused: (when) => `${when} का प्रीव्यू दोबारा इस्तेमाल होगा, इसलिए अगला इंपोर्ट जल्दी शुरू होगा।`,
    started: 'इंपोर्ट शुरू हुआ',
    startFailed: 'इंपोर्ट शुरू नहीं हो पाया',
  },

  preflight: {
    heading: 'इंपोर्ट से पहले',
    fix: 'ठीक करें',
    blocked: 'इसे ठीक करने तक यह इंपोर्ट नहीं होगा',
    checks: {
      storage: {
        title: 'कोई फ़ाइल स्टोरेज नहीं जुड़ा',
        help: 'फ़ोटो और फ़ाइलें कॉपी नहीं हो सकतीं क्योंकि कोई स्टोरेज नहीं जुड़ा। पहले Cloudflare R2 या Amazon S3 जोड़ें, वरना फ़ोटो छूट जाएँगी।',
      },
      connection: {
        title: 'Shopify जवाब नहीं दे रहा',
        help: 'आपका Shopify कनेक्शन जाँचा नहीं जा सका। कनेक्ट पेज पर फिर से टेस्ट करें।',
      },
      scope: {
        title: 'Shopify की अनुमति नहीं है',
        help: 'आपका Shopify ऐप इसे अभी पढ़ नहीं सकता। Shopify में यह अनुमति जोड़ें, फिर कनेक्शन दोबारा टेस्ट करें।',
      },
      all_orders: {
        title: 'सिर्फ़ हाल के ऑर्डर',
        help: '“Read all orders” के बिना Shopify सिर्फ़ पिछले 60 दिनों के ऑर्डर देता है।',
      },
      needs_products: {
        title: 'प्रोडक्ट अभी यहाँ नहीं हैं',
        help: 'प्रोडक्ट भी चुनें। उनके बिना ऑर्डर की लाइनें एक प्लेसहोल्डर आइटम पर जाएँगी और कलेक्शन व डिस्काउंट खाली आएँगे।',
      },
      needs_customers: {
        title: 'ग्राहक अभी यहाँ नहीं हैं',
        help: 'ग्राहक भी चुनें, वरना अनजान ग्राहकों के गिफ़्ट कार्ड छूट जाएँगे।',
      },
    },
  },

  left: {
    heading: 'जो Shopify में ही रहेगा',
    intro: 'ये चीज़ें नहीं आईं, या बदलकर आईं। नीचे दिक्कतों की सूची में हर रिकॉर्ड का नाम है।',
    owners: {
      PRODUCTVARIANT: 'वेरिएंट',
      CUSTOMER: 'ग्राहकों',
      ORDER: 'ऑर्डर',
      PAGE: 'पेज',
      ARTICLE: 'ब्लॉग पोस्ट',
      BLOG: 'ब्लॉग',
      SHOP: 'आपके स्टोर',
      LOCATION: 'लोकेशन',
      COMPANY: 'कंपनियों',
    },
    reasons: {
      metafield_owner: (n, owner) =>
        `${owner} पर ${num(n)} एक्स्ट्रा फ़ील्ड वैल्यू। अभी एक्स्ट्रा फ़ील्ड सिर्फ़ प्रोडक्ट और कलेक्शन पर हैं।`,
      field_type: (n, type) =>
        `Shopify टाइप “${type}” वाले ${num(n)} फ़ील्ड, जिसका यहाँ अभी कोई मेल नहीं है। उनकी वैल्यू Shopify में रहेगी।`,
      reference_target: (n, name) =>
        `${num(n)} फ़ील्ड (${name}) ऐसे कंटेंट टाइप की एंट्री से जुड़े हैं जो इंपोर्ट नहीं हुआ।`,
      field_value: (n) =>
        `${num(n)} वैल्यू अपने फ़ील्ड में फ़िट नहीं हुईं, जैसे किसी ऐसी चीज़ का लिंक जो इंपोर्ट नहीं हुई।`,
      time_dropped: (n) => `${num(n)} तारीख और समय वाले फ़ील्ड में सिर्फ़ तारीख रखी गई।`,
      link_label: (n) => `${num(n)} लिंक फ़ील्ड में सिर्फ़ वेब पता रखा गया, लिंक का टेक्स्ट नहीं।`,
      file_type: (n, kind) =>
        `${num(n)} ${kind} फ़ाइलें। फ़ाइलें अभी सिर्फ़ फ़ोटो और mp4 वीडियो रखती हैं, इसलिए इन्हें Shopify से डाउनलोड करें।`,
      video_too_large: (n) => `${num(n)} वीडियो Shopify के हर साइज़ में 100 MB से बड़े हैं।`,
      external_video: (n) => `${num(n)} YouTube या Vimeo लिंक। इन्हें किसी सेक्शन में लिंक से जोड़ें।`,
      model_3d: (n) => `${num(n)} 3D मॉडल, अभी सपोर्ट नहीं हैं।`,
      unused_file: (n, kind) =>
        `${num(n)} बिना इस्तेमाल ${kind === 'video' ? 'वीडियो' : 'फ़ोटो'} जिन्हें कोई इंपोर्ट की गई चीज़ इस्तेमाल नहीं करती। कॉपी करने के लिए “बिना इस्तेमाल वाली फ़ाइलें भी इंपोर्ट करें” चुनें।`,
      file_not_ready: (n) => `${num(n)} फ़ाइलें Shopify अभी तैयार कर रहा था। बाद में इंपोर्ट फिर से चलाएं।`,
      storage_unwritable: (n) =>
        `${num(n)} फ़ाइलें कॉपी नहीं हुईं क्योंकि फ़ाइल स्टोरेज काम नहीं कर रहा। Cloudflare R2 या Amazon S3 जोड़ें, फिर दोबारा कोशिश करें।`,
      buy_x_get_y: (n) => `${num(n)} “Buy X get Y” डिस्काउंट, अभी सपोर्ट नहीं हैं।`,
      app_discount: (n) => `${num(n)} डिस्काउंट किसी Shopify ऐप ने बनाए हैं। उनके नियम उसी ऐप में हैं।`,
      customer_specific: (n) => `${num(n)} डिस्काउंट सिर्फ़ चुने हुए ग्राहकों या सेगमेंट के लिए हैं।`,
      minimum_quantity: (n) =>
        `${num(n)} डिस्काउंट में कम से कम इतने आइटम चाहिए। यहाँ कम से कम रकम रखी जा सकती है।`,
      variant_specific: (n) => `${num(n)} डिस्काउंट अलग वेरिएंट पर हैं। यहाँ डिस्काउंट पूरे प्रोडक्ट पर लगते हैं।`,
      per_item_amount: (n) =>
        `${num(n)} डिस्काउंट हर आइटम पर रकम घटाते हैं। यहाँ रकम पूरे ऑर्डर पर एक बार घटती है।`,
      shipping_rules: (n) => `${num(n)} फ़्री शिपिंग डिस्काउंट देश या शिपिंग कीमत से सीमित हैं।`,
      code_characters: (n) =>
        `${num(n)} कोड में अक्षर, अंक और हाइफ़न के अलावा कुछ और है। हर एक के लिए नया कोड बनाएं।`,
      items_not_imported: (n) => `${num(n)} डिस्काउंट ऐसे प्रोडक्ट या कलेक्शन पर हैं जो इंपोर्ट नहीं हुए।`,
      gift_card_code: (n) =>
        `${num(n)} गिफ़्ट कार्ड को उसी बैलेंस के साथ नया कोड मिला, क्योंकि Shopify पूरा कोड कभी नहीं बताता। Gift cards में हर कार्ड खोलें और Resend दबाकर ग्राहक को नया कोड ईमेल करें।`,
      gift_card_no_customer: (n) =>
        `${num(n)} गिफ़्ट कार्ड में बैलेंस है पर कोई ग्राहक नहीं, तो नया कोड देने के लिए कोई नहीं है। ये Shopify पर चलते रहेंगे।`,
      gift_card_empty: (n) => `${num(n)} गिफ़्ट कार्ड खर्च हो चुके हैं, बंद हैं या उनकी तारीख निकल गई है।`,
      gift_card_over_limit: (n) =>
        `${num(n)} गिफ़्ट कार्ड में ₹2,00,000 से ज़्यादा है, जो यहाँ एक कार्ड में सबसे ज़्यादा है।`,
      gift_card_currency: (n) => `${num(n)} गिफ़्ट कार्ड किसी दूसरी करेंसी में हैं।`,
      gift_card_used_here: (n) =>
        `${num(n)} गिफ़्ट कार्ड इस स्टोर में खर्च हो चुके हैं, इसलिए यहाँ का बैलेंस वैसा ही रखा गया।`,
      redirect_manual: (n) => `${num(n)} रीडायरेक्ट आपने यहाँ खुद बनाए थे, इसलिए आपके वाले रखे गए।`,
      redirect_invalid: (n) => `${num(n)} रीडायरेक्ट होम पेज या खाली पाथ से थे, इसलिए छोड़ दिए गए।`,
    },
  },
} satisfies Translation<typeof shopifyImportContent>

export default [
  translation(shopifyImportContent, hi),
  translation(shopifyImportContent.resources, hi.resources),
  translation(shopifyImportContent.home, hi.home),
  translation(shopifyImportContent.csv, hi.csv),
  translation(shopifyImportContent.connect, hi.connect),
  translation(shopifyImportContent.run, hi.run),
  translation(shopifyImportContent.preflight, hi.preflight),
  translation(shopifyImportContent.remaining, hi.remaining),
]
