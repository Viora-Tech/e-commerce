import { layoutContent } from '@/data/layout'
import { translation } from '@/lib/i18n'

export default [
  translation(layoutContent, {
    dashboard: 'डैशबोर्ड',
    details: 'पूरी जानकारी',
    noChange: 'कोई बदलाव नहीं',
    moreActions: 'और विकल्प',
    save: 'सेव करें',
    filter: 'फ़िल्टर',
    skipToContent: 'सीधे कंटेंट पर जाएं',
    breadcrumb: 'ब्रेडक्रंब',
    notFound: {
      heading: 'पेज नहीं मिला',
      body: 'लिंक पुराना हो सकता है, या वह चीज़ हटा दी गई है।',
      home: 'डैशबोर्ड पर जाएं',
    },
    error: {
      heading: 'यह पेज लोड नहीं हुआ',
      body: 'हमारी तरफ़ से कुछ गड़बड़ हुई। थोड़ी देर में फिर कोशिश करें।',
      retry: 'फिर कोशिश करें',
    },
    seeMore: 'और देखें',
    pagination: { label: 'पेज', previous: 'पिछला', next: 'अगला' },
    search: 'खोजें',
    sort: 'क्रम',
    filterRows: 'लाइनें फ़िल्टर करें',
    more: 'और',
    viewAll: 'सब देखें',
    viewAllApps: (n) => `सभी ऐप्स (${n})`,
    appStore: 'ऐप स्टोर',
    noStore: 'कोई स्टोर नहीं चुना',
    toggleTheme: 'थीम बदलें',
    scroll: {
      showing: (n) => `${n} आइटम दिख रहे हैं · और देखने के लिए स्क्रोल करें`,
      showingAll: (n) => `सभी ${n} आइटम दिख रहे हैं`,
      more: 'और देखने के लिए स्क्रोल करें',
      expand: 'सब दिखाएं',
      collapse: 'कम दिखाएं',
    },
  }),
]
