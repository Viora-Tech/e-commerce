import { profitReportContent } from '@/data/profit-report'
import { translation } from '@/lib/i18n'

export default [
  translation(profitReportContent, {
    title: 'भरोसे लायक मुनाफ़ा',
    floor: 'आपके डाले गए खर्चों के हिसाब से। कुछ खर्च अलग निकले तो असली मुनाफ़ा थोड़ा ज़्यादा या कम हो सकता है।',
    netProfit: 'शुद्ध मुनाफ़ा',
    atLeast: 'कम से कम',
    perOrder: 'प्रति ऑर्डर औसत मुनाफ़ा',
    perUnit: 'प्रति नग औसत मुनाफ़ा',
    basket: (size) => (size === '1' ? '1 सामान वाले ऑर्डर' : `${size} सामान वाले ऑर्डर`),
    basketNote: (orders) => (orders === 1 ? '1 ऑर्डर' : `${orders} ऑर्डर`),
    basketTitle: 'टोकरी के साइज़ के हिसाब से प्रति ऑर्डर मुनाफ़ा',
    basketHelp: 'पूरी टोकरी का एक पार्सल और एक डिलीवरी, इसलिए बड़ी टोकरी ज़्यादा कमाती है।',
    expensesNote: (expenses) => `${expenses} महीने के खर्च घटाकर`,
    noOrders: 'कोई ऑर्डर नहीं',
    estimated: (estimated, orders) => `${orders} में से ${estimated} ऑर्डर अभी अनुमान पर`,
    allReal: 'हर खर्च पता है',
    estimatedHelp:
      'इन ऑर्डर पर पैकिंग, डिलीवरी या पेमेंट फ़ीस अभी अनुमान है; कूरियर या गेटवे के बताने पर असली हो जाती है।',
    profitable: 'इन तारीख़ों में मुनाफ़े में',
    short: (amount, orders) =>
      orders === null
        ? `खर्चों से ${amount} कम`
        : `${amount} कम: आपके औसत मुनाफ़े पर करीब ${orders} और ऑर्डर चाहिए`,
    soFar: (month, days, total, counted, full) =>
      `${month} अभी चल रहा है: खर्च अब तक के ${total} में से ${days} दिन के गिने गए (${full} में से ${counted})।`,
    manageExpenses: 'महीने के खर्च',
    setCosts: 'मुनाफ़े के लिए खर्च',
  }),
]
