import { draftStoreCreditContent } from '@/data/draft-store-credit'
import { translation } from '@/lib/i18n'

export default [
  translation(draftStoreCreditContent, {
    heading: 'स्टोर क्रेडिट',
    balance: (amount: string) => `बैलेंस ${amount}`,
    none: 'इस ग्राहक के पास कोई स्टोर क्रेडिट नहीं है।',
    apply: 'स्टोर क्रेडिट लगाएँ',
    applied: (amount: string) => `${amount} लगाया गया`,
    appliedNote: 'ड्राफ़्ट को ऑर्डर में बदलने पर बैलेंस से कटेगा।',
    edit: 'बदलें',
    remove: 'हटाएँ',
    loadFailed: 'स्टोर क्रेडिट लोड नहीं हुआ।',
    dialog: {
      title: 'स्टोर क्रेडिट लगाएँ',
      amount: 'रकम',
      max: (amount: string) => `${amount} तक: बैलेंस, या ड्राफ़्ट का टोटल अगर वह कम है।`,
      fillMax: (amount: string) => `${amount} लगाएँ`,
      tooMuch: (amount: string) => `यह ${amount} से ज़्यादा है।`,
      apply: 'लगाएँ',
      cancel: 'कैंसिल',
    },
    line: 'स्टोर क्रेडिट',
    toPay: 'देना है',
    problems: {
      no_customer: 'स्टोर क्रेडिट के लिए ग्राहक चुनें, या इसे हटाएँ।',
      over_total: 'स्टोर क्रेडिट टोटल से ज़्यादा है। इसे कम करें।',
      over_balance: 'स्टोर क्रेडिट ग्राहक के बैलेंस से ज़्यादा है। इसे कम करें।',
    },
    nothingToInvoice: 'पूरा पेमेंट स्टोर क्रेडिट से है। इसे सीधे ऑर्डर में बदलें।',
  }),
]
