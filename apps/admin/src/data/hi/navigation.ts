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
  '/orders/returns': { title: 'रिटर्न' },
  '/products': { title: 'प्रोडक्ट' },
  '/products/collections': { title: 'कलेक्शन' },
  '/products/inventory': { title: 'इन्वेंटरी' },
  '/products/purchase-orders': { title: 'परचेज़ ऑर्डर' },
  '/products/transfers': { title: 'ट्रांसफ़र' },
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
  '/growth/campaigns': { title: 'कैंपेन' },
  '/growth/automations': { title: 'ऑटोमेशन' },
  '/growth/links': { title: 'लिंक' },
  '/discounts': { title: 'डिस्काउंट' },
  '/online-store': { title: 'ऑनलाइन स्टोर' },
  '/online-store/themes': { title: 'थीम' },
  '/online-store/pages': { title: 'पेज' },
  '/online-store/preferences': { title: 'प्राथमिकताएं' },
  '/apps': { title: 'ऐप्स' },
  '/settings': {
    title: 'Settings',
    body: 'आपकी सेटअप चेकलिस्ट और सारे सेटिंग पेज।',
  },
  '/settings/general': {
    title: 'सामान्य',
    body: 'स्टोर का नाम, संपर्क, पता, करेंसी और टाइम ज़ोन।',
  },
  '/settings/payments': {
    title: 'पेमेंट',
    body: 'कैश ऑन डिलीवरी (COD), UPI, Razorpay और हर तरीके पर फ़ीस या डिस्काउंट।',
  },
  '/settings/shipping': {
    title: 'शिपिंग',
    body: 'कूरियर, शिपिंग रेट, डिलीवरी का अनुमान और डिस्पैच पॉलिसी।',
  },
  '/settings/returns': {
    title: 'रिटर्न',
    body: 'ग्राहक कितने दिन में रिटर्न कर सकते हैं, कौन से कारण मंज़ूर हैं, रीस्टॉक और रिफ़ंड।',
  },
  '/settings/notifications': {
    title: 'नोटिफ़िकेशन',
    body: 'ग्राहकों को जाने वाले ऑर्डर ईमेल और WhatsApp मैसेज।',
  },
  '/settings/files': {
    title: 'फ़ाइलें',
    body: 'प्रोडक्ट की फ़ोटो और अपलोड कहाँ रखे जाएं: लोकल फ़ोल्डर या आपका अपना R2 बकेट।',
  },
  '/settings/staff': {
    title: 'स्टाफ़',
    body: 'कौन इस स्टोर में साइन इन कर सकता है और क्या-क्या कर सकता है।',
  },
  '/settings/custom-data': {
    title: 'कस्टम डेटा',
    body: 'प्रोडक्ट और कलेक्शन के एक्स्ट्रा फ़ील्ड, और आपके कंटेंट टाइप।',
  },
  '/settings/domains': {
    title: 'डोमेन',
    body: 'वे पते जिन पर आपका स्टोर खुलता है।',
  },
  '/settings/invoices': { title: 'इनवॉइस' },
  '/settings/appearance': {
    title: 'रंग-रूप',
    body: 'एडमिन का एक्सेंट रंग और लाइट या डार्क मोड।',
  },
  '/settings/account': {
    title: 'अकाउंट',
    body: 'आपकी अपनी पसंद, जैसे यह एडमिन किस भाषा में दिखे।',
  },
  '/dev': { title: 'डेवलपर' },
}

/** Sidebar group headings, keyed by their English label. */
export const hindiNavGroups: Record<string, string> = {
  'Main menu': 'मेन मेन्यू',
  'Sales channels': 'सेल्स चैनल',
  Apps: 'ऐप्स',
}

export default [
  translation(navigationContent, {
    pickStore: 'स्टोर चुनें',
    stores: 'स्टोर',
    allStores: 'सभी स्टोर',
    storesAvailable: (n) => `${n} उपलब्ध`,
    viewStore: 'स्टोर देखें',
    signOut: 'साइन आउट',
    collapse: 'साइडबार छोटा करें',
    adminGroup: 'एडमिन',
    expandSection: (label) => `${label} के पेज दिखाएं`,
    collapseSection: (label) => `${label} के पेज छिपाएं`,
    search: {
      placeholder: 'ऑर्डर, प्रोडक्ट या ग्राहक खोजें',
      shortcut: '⌘K',
      empty: 'कुछ नहीं मिला',
      orders: 'ऑर्डर',
      products: 'प्रोडक्ट',
      orderLabel: (n, who) => `#${n}${who ? `, ${who}` : ''}`,
    },
    account: 'अकाउंट',
    toggleTheme: 'थीम बदलें',
    openMenu: 'मेन्यू खोलें',
    notifications: { label: 'नोटिफ़िकेशन', empty: 'अभी देखने को कुछ नया नहीं है।' },
  }),
]
