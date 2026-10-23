import { siteConfig } from '@commerce/config/site'
import { navigationContent } from '@/data/navigation'
import { translation } from '@/lib/i18n'

/**
 * Hindi names of admin pages, keyed by route. The sidebar, the top bar's page title, the
 * Settings rail and the Settings home look pages up here by `href` (see `lib/page-names.ts`),
 * so a page added in English without an entry keeps its English name, and reordering the nav
 * never shifts a label. A test checks every key here is a route the admin really has.
 */
export const hindiPageNames: Record<string, { title: string; body?: string }> = {
  '/': { title: 'होम' },
  '/orders': { title: 'ऑर्डर' },
  '/orders/drafts': { title: 'ड्राफ़्ट' },
  '/orders/abandoned-checkouts': { title: 'अधूरे चेकआउट' },
  '/orders/shipments': { title: 'शिपमेंट' },
  '/orders/shipments/pickups': { title: 'पिकअप और मैनिफ़ेस्ट' },
  '/orders/shipments/attention': { title: 'जिन डिलीवरी पर ध्यान चाहिए' },
  '/orders/returns': { title: 'रिटर्न' },
  '/products': { title: 'प्रोडक्ट' },
  '/products/collections': { title: 'कलेक्शन' },
  '/stock': { title: 'स्टॉक' },
  '/stock/inventory': { title: 'इन्वेंटरी' },
  '/stock/purchase-orders': { title: 'परचेज़ ऑर्डर' },
  '/stock/transfers': { title: 'ट्रांसफ़र' },
  '/stock/inbound-shipments': { title: 'आने वाली खेप' },
  '/stock/suppliers': { title: 'सप्लायर' },
  '/products/gift-cards': { title: 'गिफ़्ट कार्ड' },
  '/customers': { title: 'ग्राहक' },
  '/customers/segments': { title: 'सेगमेंट' },
  '/content': { title: 'कंटेंट' },
  '/content/files': { title: 'फ़ाइलें' },
  '/content/metaobjects': { title: 'कंटेंट टाइप' },
  '/content/menus': { title: 'मेन्यू' },
  '/content/menus/redirects': { title: 'URL रीडायरेक्ट' },
  '/content/blog-posts': { title: 'ब्लॉग पोस्ट' },
  '/analytics': { title: 'एनालिटिक्स' },
  '/analytics/reports': { title: 'रिपोर्ट' },
  '/analytics/live': { title: 'लाइव व्यू' },
  '/growth': { title: 'ग्रोथ' },
  '/growth/attribution': { title: 'एट्रिब्यूशन' },
  '/growth/autopilot': { title: 'ऑटोपायलट' },
  '/growth/campaigns': { title: 'कैंपेन' },
  '/growth/automations': { title: 'ऑटोमेशन' },
  '/growth/links': { title: 'ट्रैकिंग लिंक' },
  '/discounts': { title: 'डिस्काउंट' },
  '/online-store': { title: 'ऑनलाइन स्टोर' },
  '/online-store/themes': { title: 'थीम' },
  '/online-store/pages': { title: 'पेज' },
  '/online-store/preferences': { title: 'प्राथमिकताएं' },
  '/online-store/seo': { title: 'SEO' },
  '/apps': { title: 'ऐप्स' },
  '/settings': {
    title: 'Settings',
    body: 'आपकी सेटअप चेकलिस्ट और सारे सेटिंग पेज।',
  },
  '/settings/store': {
    title: 'स्टोर की जानकारी',
    body: 'दुकान का नाम, संपर्क, पता, करेंसी और टाइम ज़ोन, और आपके स्टोर का डेटा।',
  },
  '/settings/domains': {
    title: 'डोमेन',
    body: 'वे वेबसाइट पते जिन पर आपकी दुकान खुलती है।',
  },
  '/settings/locations': {
    title: 'लोकेशन और गोदाम',
    body: 'आपका स्टॉक कहाँ रखा है, और हर जगह किस GST नंबर से बिल बनता है।',
  },
  '/settings/billing': {
    title: 'प्लान और बिलिंग',
    body: 'आपका प्लान, इस महीने स्टोर ने कितना इस्तेमाल किया, और आपके इनवॉइस।',
  },
  '/settings/mcp': {
    title: 'MCP और API',
    body: 'Claude, ChatGPT, Cursor जैसे AI टूल और स्क्रिप्ट के एक्सेस टोकन, और उन्होंने क्या किया।',
  },
  '/settings/payments': {
    title: 'पेमेंट',
    body: 'ग्राहक आपको कैसे पेमेंट करें: UPI, कार्ड, कैश ऑन डिलीवरी (COD) और हर तरीके की फ़ीस।',
  },
  '/settings/checkout': {
    title: 'चेकआउट',
    body: 'ग्राहक क्या-क्या भरें, कम से कम ऑर्डर वैल्यू, COD के नियम और चेकआउट कैसा दिखे।',
  },
  '/settings/shipping': {
    title: 'शिपिंग और डिलीवरी',
    body: 'आप कहाँ डिलीवर करते हैं, कितना चार्ज है, आपके डिब्बे, कूरियर और डिस्पैच के दिन।',
  },
  '/settings/returns': {
    title: 'रिटर्न',
    body: 'ग्राहक कितने दिन में रिटर्न कर सकते हैं, कौन से कारण मंज़ूर हैं, और रिफ़ंड।',
  },
  '/settings/taxes': {
    title: 'GST और इनवॉइस',
    body: 'आपके GST नंबर, कीमतों में GST कैसे जुड़ता है, और इनवॉइस के नंबर कैसे बनते हैं।',
  },
  '/settings/costs': {
    title: 'मुनाफ़े के लिए खर्च',
    body: 'पेमेंट गेटवे और कैश ऑन डिलीवरी पर आपका कितना खर्च होता है, ताकि ऑर्डर का मुनाफ़ा सही दिखे।',
  },
  '/settings/customer-accounts': {
    title: 'ग्राहक अकाउंट',
    body: 'बिना अकाउंट चेकआउट, और ईमेल, SMS या WhatsApp से साइन-इन कोड।',
  },
  '/settings/privacy': {
    title: 'प्राइवेसी और डेटा रिक्वेस्ट',
    body: 'कुकी बैनर, मार्केटिंग की सहमति, और ग्राहकों का अपना डेटा मांगना या मिटवाना।',
  },
  '/settings/policies': {
    title: 'पॉलिसी',
    body: 'रिफ़ंड, प्राइवेसी, शर्तें, शिपिंग और संपर्क पेज, तैयार टेम्पलेट से।',
  },
  '/settings/notifications': {
    title: 'नोटिफ़िकेशन',
    body: 'ग्राहकों को जाने वाले ऑर्डर ईमेल और WhatsApp मैसेज, और वे किस पते से जाते हैं।',
  },
  '/settings/staff': {
    title: 'स्टाफ़',
    body: 'कौन इस स्टोर में साइन इन कर सकता है और क्या-क्या कर सकता है।',
  },
  '/settings/ai': {
    title: 'AI',
    body: 'AI से लिखें और अपने स्टोर से पूछें: इस महीने कितना इस्तेमाल हुआ, और इन्हें चालू करना।',
  },
  '/settings/custom-data': {
    title: 'कस्टम डेटा',
    body: 'प्रोडक्ट और कलेक्शन के एक्स्ट्रा फ़ील्ड, और आपके कंटेंट टाइप।',
  },
  '/settings/invoices': { title: 'इनवॉइस' },
  '/settings/appearance': {
    title: 'रंग-रूप',
    body: 'लाइट या डार्क मोड और आपका एक्सेंट रंग, सिर्फ़ आपके लिए।',
  },
  '/account': { title: 'अकाउंट' },
  '/account/security': { title: 'साइन-इन और सुरक्षा' },
  '/account/sessions': { title: 'सेशन' },
  '/account/notifications': { title: 'नोटिफ़िकेशन' },
  '/account/stores': { title: 'स्टोर' },
  '/account/language': { title: 'भाषा और क्षेत्र' },
  '/account/appearance': {
    title: 'रंग-रूप',
    body: 'लाइट या डार्क मोड और आपका एक्सेंट रंग, सिर्फ़ आपके लिए।',
  },
  '/content/files/storage': { title: 'फ़ाइल स्टोरेज' },
  '/dev': { title: 'डेवलपर' },
}

/** Sidebar group headings, keyed by their English label. */
export const hindiNavGroups: Record<string, string> = {
  Workspace: 'वर्कस्पेस',
  'Sales channels': 'सेल्स चैनल',
  'Agentic sales': 'AI एजेंट से बिक्री',
  'Catalog readiness': 'कैटलॉग की तैयारी',
  Controls: 'कंट्रोल',
  'Social media': 'सोशल मीडिया',
  Apps: 'ऐप्स',
  Settings: 'सेटिंग',
}

export default [
  translation(navigationContent, {
    pickStore: 'स्टोर चुनें',
    stores: 'स्टोर',
    allStores: 'सभी स्टोर',
    storesAvailable: (n) => `${n} उपलब्ध`,
    viewStore: 'स्टोर देखें',
    signOut: 'लॉग आउट',
    collapse: 'साइडबार छोटा करें',
    expand: 'साइडबार बड़ा करें',
    togglePanel: 'साइडबार दिखाएं या छिपाएं',
    settingsGroup: 'सेटिंग',
    expandSection: (label) => `${label} के पेज दिखाएं`,
    collapseSection: (label) => `${label} के पेज छिपाएं`,
    countHint: (n) => `${n} भेजने बाकी`,
    search: {
      placeholder: 'ऑर्डर, प्रोडक्ट या ग्राहक खोजें',
      field: `खोजें या ${siteConfig.brand.name} AI से पूछें…`,
      shortcut: '⌘K',
      askAi: 'AI से पूछें',
      lead: 'खोजें या AI से पूछें',
      examples: ['भेजने वाले ऑर्डर', 'इस हफ़्ते सबसे ज़्यादा बिका', 'कम स्टॉक', 'आज की बिक्री'],
      empty: 'कुछ नहीं मिला',
      orders: 'ऑर्डर',
      products: 'प्रोडक्ट',
      orderLabel: (n, who) => `#${n}${who ? `, ${who}` : ''}`,
    },
    storeRole: { owner: 'मालिक', member: 'टीम मेंबर' },
    switchStore: 'स्टोर बदलें',
    openStoreAddress: (domain) => `${domain} खोलें`,
    usage: {
      title: 'इस महीने के ऑर्डर',
      of: (used, limit) => `${limit} में से ${used}`,
      moreRoom: (plan) => `${plan} प्लान में ज़्यादा जगह`,
    },
    account: 'अकाउंट',
    menu: {
      settings: 'सेटिंग',
      help: 'WhatsApp पर मदद',
      language: 'भाषा',
      english: 'English',
      hindi: 'हिंदी',
    },
    toggleTheme: 'थीम बदलें',
    openMenu: 'मेन्यू खोलें',
    tips: {
      search: (shortcut: string) => `खोजें · ${shortcut}`,
      askAi: (mod: string) => `${siteConfig.brand.name} AI से पूछें · ${mod}J`,
      viewStore: (domain: string) => `स्टोर खोलें · ${domain} ↗`,
      theme: (name: string) => `थीम · ${name}`,
    },
    theme: {
      light: 'लाइट',
      dark: 'डार्क',
      system: 'सिस्टम',
      systemHint: 'आपके डिवाइस के अनुसार',
    },
  }),
]
