import { automationRecordsContent } from '@/data/automation-records'
import { translation } from '@/lib/i18n'

export default [
  translation(automationRecordsContent, {
    run: 'ऑटोमेशन चलाएं',
    runs: 'ऑटोमेशन रन',
    nouns: {
      order: { one: 'ऑर्डर', many: 'ऑर्डर' },
      customer: { one: 'ग्राहक', many: 'ग्राहकों' },
      product: { one: 'प्रोडक्ट', many: 'प्रोडक्ट' },
    },
    dialog: {
      title: 'ऑटोमेशन चलाएं',
      description: (count, noun) =>
        count === 1
          ? `इस ${noun.one} पर चलाने के लिए एक वर्कफ़्लो चुनें। यह एक बार चलेगा, जैसे उसका ट्रिगर हुआ हो।`
          : `चुने गए ${count} ${noun.many} पर चलाने के लिए एक वर्कफ़्लो चुनें। हर एक का अपना रन बनेगा।`,
      search: 'वर्कफ़्लो खोजें',
      submit: 'चलाएं',
      loading: 'वर्कफ़्लो लोड हो रहे हैं…',
      empty: 'अभी कोई वर्कफ़्लो हाथ से नहीं चलाया जा सकता।',
      emptyBody: 'ऑटोमेशन में "हाथ से चलाएं" से शुरू होने वाला वर्कफ़्लो बनाएं और चालू करें, फिर वह यहां दिखेगा।',
      openApp: 'ऑटोमेशन खोलें',
      noMatch: 'आपकी खोज से कोई वर्कफ़्लो नहीं मिला।',
      steps: (n) => (n === 1 ? '1 ऐक्शन' : `${n} ऐक्शन`),
      asks: (n) => `${n} चलने से पहले पूछते हैं`,
      lastRun: (ago) => `आख़िरी रन ${ago}`,
      neverRun: 'अभी तक नहीं चला',
      notAllowed: 'इसे चलाने के लिए आपको इस वर्कफ़्लो के हर ऐक्शन की अनुमति चाहिए।',
      tooMany: (max) => `ऑटोमेशन चलाने के लिए ज़्यादा से ज़्यादा ${max} रिकॉर्ड चुनें।`,
      started: (started, skipped) => {
        const done = `${started} रन शुरू हुए`
        return skipped === 0 ? done : `${done}। ${skipped} पहले से चल रहे थे या शुरू नहीं हो सके।`
      },
      viewRuns: 'रन देखें',
      failed: 'ऑटोमेशन शुरू नहीं हुआ। फिर से कोशिश करें।',
    },
    history: {
      title: 'ऑटोमेशन',
      empty: (noun) => `इस ${noun} पर अभी तक कोई ऑटोमेशन नहीं चला।`,
      openApp: 'ऑटोमेशन खोलें',
      viewAll: 'सभी देखें',
      changed: 'इससे बदला गया',
      error: 'ऑटोमेशन हिस्ट्री लोड नहीं हो सकी।',
    },
  }),
]
