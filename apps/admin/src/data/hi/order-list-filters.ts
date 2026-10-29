import {
  abandonedFiltersContent,
  draftFiltersContent,
  returnFiltersContent,
  shipmentFiltersContent,
} from '@/data/order-list-filters'
import { translation } from '@/lib/i18n'

const dateOptions = { '7d': 'पिछले 7 दिन', '30d': 'पिछले 30 दिन', '90d': 'पिछले 90 दिन' }

export default [
  translation(draftFiltersContent, {
    created: 'बनाया गया',
    anyDate: 'कोई भी तारीख',
    dateOptions,
    total: 'कुल रकम',
    totalMin: 'कम से कम रकम',
    totalMax: 'ज़्यादा से ज़्यादा रकम',
    show: (n: number) => `${n} ड्राफ़्ट दिखाएं`,
  }),
  translation(abandonedFiltersContent, {
    active: 'आख़िरी बार देखा',
    anyDate: 'पिछले 30 दिन',
    dateOptions,
    value: 'कार्ट की रकम',
    valueMin: 'कम से कम रकम',
    valueMax: 'ज़्यादा से ज़्यादा रकम',
    contact: 'छोड़ा गया संपर्क',
    anyContact: 'कोई भी संपर्क',
    contactOptions: { email: 'ईमेल', phone: 'फ़ोन नंबर', both: 'ईमेल और फ़ोन' },
    show: (n: number) => `${n} चेकआउट दिखाएं`,
  }),
  translation(returnFiltersContent, {
    reason: 'वजह',
    reasonOptions: {
      damaged: 'टूटा हुआ',
      wrong_item: 'गलत सामान',
      not_as_described: 'जैसा बताया वैसा नहीं',
      quality: 'क्वालिटी',
      size: 'साइज़',
      changed_mind: 'मन बदल गया',
      other: 'कुछ और',
    },
    outcome: 'नतीजा',
    outcomeOptions: {
      refund: 'रिफ़ंड',
      exchange: 'बदला गया',
      store_credit: 'स्टोर क्रेडिट',
      reship: 'फिर से भेजा',
      none: 'बिना कुछ दिए बंद',
    },
    requested: 'माँगा गया',
    anyDate: 'कोई भी तारीख',
    dateOptions,
    show: (n: number) => `${n} रिटर्न दिखाएं`,
  }),
  translation(shipmentFiltersContent, {
    courier: 'कूरियर',
    anyCourier: 'कोई भी कूरियर',
    ndr: 'डिलीवरी में दिक्कत',
    ndrOptions: {
      none: 'कोई दिक्कत नहीं',
      pending: 'आपको कुछ करना है',
      action_taken: 'कदम उठाया गया',
      resolved: 'सुलझ गया',
    },
    booked: 'बुक किया',
    anyDate: 'कोई भी तारीख',
    dateOptions,
    method: 'पेमेंट का तरीका',
    methodOptions: { cod: 'कैश ऑन डिलीवरी', prepaid: 'प्रीपेड' },
    show: (n: number) => `${n} शिपमेंट दिखाएं`,
    noResults: 'इन फ़िल्टर से कोई शिपमेंट नहीं मिला',
  }),
]
