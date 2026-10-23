import { customDataOverviewContent } from '@/data/custom-data'
import { translation } from '@/lib/i18n'

export default [
  translation(customDataOverviewContent, {
    back: 'कस्टम डेटा',
    overview: {
      fieldsHeading: 'एक्स्ट्रा फ़ील्ड',
      fieldsBody: 'किसी तरह के रिकॉर्ड में जोड़े गए फ़ील्ड। फ़ील्ड जोड़ने, बदलने या क्रम बदलने के लिए खोलें।',
      columns: { kind: 'रिकॉर्ड', fields: 'फ़ील्ड' },
      count: (n) => (n === 0 ? 'अभी कोई फ़ील्ड नहीं' : `${n} फ़ील्ड`),
      typesColumns: { type: 'कंटेंट टाइप', entries: 'एंट्री' },
      typesEmptyHeading: 'अभी कोई कंटेंट टाइप नहीं',
      typesEmptyBody:
        'अपना कंटेंट बनाएं, जैसे FAQ, साइज़ चार्ट या स्टोर की लोकेशन। खाली से शुरू करें या तैयार प्रीसेट से।',
    },
    ownerHints: {
      product: 'केयर गाइड, मटीरियल, वारंटी',
      variant: 'हर साइज़ या रंग के लिए, जैसे फ़िट नोट',
      collection: 'कलेक्शन के लिए बैनर और एक्स्ट्रा टेक्स्ट',
      customer: 'निजी नोट, जैसे जन्मदिन या GST नंबर',
      order: 'निजी जानकारी, जैसे गिफ़्ट मैसेज',
      page: 'आपके पेजों के लिए एक्स्ट्रा कंटेंट',
      article: 'आपकी ब्लॉग पोस्ट के लिए एक्स्ट्रा कंटेंट',
      shop: 'पूरे स्टोर की वैल्यू, जैसे सपोर्ट नंबर',
    },
  }),
]
