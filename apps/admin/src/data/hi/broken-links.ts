import { brokenLinksContent } from '@/data/broken-links'
import { translation } from '@/lib/i18n'

export default [
  translation(brokenLinksContent, {
    views: {
      label: 'रीडायरेक्ट व्यू',
      redirects: 'रीडायरेक्ट',
      broken: 'टूटे लिंक',
    },
    summary: (n: number) =>
      n === 0
        ? 'अभी कोई टूटा लिंक नहीं। जो पेज "नहीं मिला" दिखाते हैं, वे यहाँ आएँगे।'
        : `${n} पुराने पते "नहीं मिला" पर पहुँचे`,
    resource: { singular: 'टूटा लिंक', plural: 'टूटे लिंक' },
    loadFailed: 'टूटे लिंक लोड नहीं हो सके',
    columns: {
      path: 'टूटा पाथ',
      hits: 'विज़िट',
      lastSeen: 'आख़िरी बार',
      suggestion: 'सुझाया रीडायरेक्ट',
    },
    from: (referrer: string) => `${referrer} से`,
    noSuggestion: 'कोई मिलता-जुलता पेज नहीं',
    create: 'रीडायरेक्ट बनाएं',
    created: 'रीडायरेक्ट बन गया',
    createFailed: 'रीडायरेक्ट नहीं बन सका',
    choose: 'टारगेट चुनें',
    dismiss: 'हटाएं',
    dismissSelected: (n: number) => `${n} हटाएं`,
    dismissed: (n: number) => `${n} लिंक हटाए गए`,
    dismissFailed: 'हटा नहीं सके',
    actionsLabel: 'टूटे लिंक के एक्शन',
    empty: {
      heading: 'कोई टूटा लिंक नहीं',
      body: 'जब कोई ग्राहक या सर्च इंजन ऐसा पता खोलता है जो मौजूद नहीं है, वह यहाँ सबसे मिलते-जुलते प्रोडक्ट या कलेक्शन के साथ दिखता है, ताकि आप एक क्लिक में रीडायरेक्ट कर सकें।',
      searchHeading: 'कोई टूटा लिंक मेल नहीं खाता',
    },
  }),
]
