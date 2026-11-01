import { paymentProvidersContent } from '@/data/payment-providers'
import { translation } from '@/lib/i18n'

export default [
  translation(paymentProvidersContent, {
    overview: {
      providers: {
        heading: 'पेमेंट प्रोवाइडर',
        help: 'वे कंपनियाँ जो चेकआउट पर ऑनलाइन पेमेंट लेती हैं: UPI, कार्ड, नेटबैंकिंग और वॉलेट।',
        add: 'प्रोवाइडर जोड़ें',
        empty: 'अभी कोई पेमेंट प्रोवाइडर नहीं',
        emptyHelp: 'UPI, कार्ड और नेटबैंकिंग से ऑनलाइन पेमेंट लेने के लिए एक कनेक्ट करें।',
        choose: 'प्रोवाइडर चुनें',
        main: 'मुख्य',
        more: (n: number) => `+${n}`,
        order: 'चेकआउट क्रम',
        orderHelp: 'चेकआउट पहले किस प्रोवाइडर को आज़माए, और कौन सा चालू है',
      },
      manual: {
        heading: 'मैनुअल पेमेंट तरीके',
        help: 'ग्राहक सीधे आपको पेमेंट करते हैं। पैसा आने पर आप ऑर्डर को पेड मार्क करते हैं।',
        add: 'तरीका',
        all: 'सभी मैनुअल तरीके',
      },
      config: {
        heading: 'पेमेंट कॉन्फ़िगरेशन',
        help: 'पेमेंट कैसे लिया जाता है और ग्राहकों को पेमेंट के कौन से तरीके दिखते हैं।',
      },
    },
    status: {
      active: 'चालू',
      inactive: 'बंद',
      test: 'Test मोड',
      attention: 'ध्यान दें',
    },
    provider: {
      manageKeys: 'Keys संभालें',
      more: 'और ऐक्शन',
      makeMain: 'मुख्य प्रोवाइडर बनाएँ',
      madeMain: (name: string) => `अब चेकआउट पहले ${name} को आज़माएगा।`,
      makeMainFailed: 'सेव नहीं हो सका। फिर से कोशिश करें।',
      mainHelp: 'मुख्य प्रोवाइडर: चेकआउट इसे पहले आज़माता है।',
      notFound: 'यह पेमेंट प्रोवाइडर आपकी दुकान में उपलब्ध नहीं है।',
      notConnected: 'अभी कनेक्ट नहीं है',
      about: {
        heading: (name: string) => `${name} के बारे में`,
        fees: 'फ़ीस',
        connection: 'कनेक्शन',
        lastPayment: 'आख़िरी पेमेंट',
        noPaymentsYet: 'अभी कोई पेमेंट नहीं',
      },
      methods: {
        heading: 'पेमेंट के तरीके',
        help: (name: string) =>
          `${name} जिन तरीकों से पेमेंट लेता है। किसी को बंद करने पर वह हर प्रोवाइडर के लिए चेकआउट से हट जाता है।`,
        routedTo: (name: string) => `चेकआउट इसे ${name} को भेजता है`,
        turnOn: (name: string) => `${name} चालू करें`,
        none: 'यह प्रोवाइडर अपने पेमेंट तरीके नहीं बताता।',
        saved: 'सेव हो गया।',
        saveFailed: 'सेव नहीं हो सका। फिर से कोशिश करें।',
      },
    },
  }),
]
