import { affiliateFiltersContent } from '@/data/affiliate-filters'
import { translation } from '@/lib/i18n'

export default [
  translation(affiliateFiltersContent, {
    affiliates: {
      status: 'स्थिति',
      program: 'प्रोग्राम',
      joined: 'जुड़े',
      earned: 'कमाई',
      noResults: {
        heading: 'इन फ़िल्टर से कोई एफ़िलिएट नहीं मिला',
        body: 'कोई और सर्च आज़माएँ या फ़िल्टर हटाएँ।',
      },
    },
    commissions: {
      status: 'स्थिति',
      source: 'कहाँ से',
      affiliate: 'एफ़िलिएट',
      placed: 'ऑर्डर की तारीख़',
      amount: 'कमीशन',
      flagged: 'फ़्रॉड जाँच में रुका',
      noResults: {
        heading: 'इन फ़िल्टर से कोई कमीशन नहीं मिला',
        body: 'कोई और सर्च आज़माएँ या फ़िल्टर हटाएँ।',
      },
    },
  }),
]
