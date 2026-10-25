import { dtdcAppContent } from '@/data/dtdc'
import { translation } from '@/lib/i18n'

export default [
  translation(dtdcAppContent, {
    connect: {
      title: 'DTDC जोड़ें',
      intro: 'अपना DTDC अकाउंट जोड़ने के लिए नीचे के तीन कदम पूरे करें। इसके लिए पहले DTDC से API एक्सेस चाहिए।',
      dashboardUrl: 'https://www.dtdc.in/',
      signupUrl: 'https://www.dtdc.in/',
      openDashboard: 'DTDC खोलें',
      noAccount: 'DTDC का बिज़नेस अकाउंट नहीं है?',
      signUp: 'DTDC से संपर्क करें',
      steps: {
        one: {
          title: 'DTDC से API एक्सेस माँगें',
          body: 'आपके DTDC अकाउंट मैनेजर आपके customer code के लिए API (softdata) एक्सेस चालू करते हैं और API key ईमेल करते हैं।',
        },
        two: {
          title: 'API key और ट्रैकिंग लॉगिन ढूँढें',
          body: 'उसी मेल में आपका customer code, API key और DTDC की ट्रैकिंग सेवा का अलग यूज़रनेम और पासवर्ड होता है।',
          warning: 'ट्रैकिंग यूज़रनेम-पासवर्ड के बिना भी बुकिंग और लेबल चलेंगे, पर शिपमेंट ट्रैक नहीं होंगे।',
        },
        three: {
          title: 'नीचे डालें और जाँचें',
          body: 'फ़ील्ड भरें, फिर सेव करने से पहले "कनेक्शन जाँचें" से पक्का करें कि सब ठीक है।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n: number) => `कदम ${n}`,
      mode: {
        label: 'मोड',
        test: 'टेस्ट',
        live: 'लाइव',
        help: {
          test: 'DTDC का डेमो सर्वर इस्तेमाल हो रहा है। डेमो API key डालें, लाइव key यहाँ नहीं चलती।',
          live: 'आपका लाइव DTDC अकाउंट इस्तेमाल हो रहा है। असली बुकिंग और असली चार्ज।',
        },
      },
      fields: {
        apiKey: {
          label: 'API key',
          help: 'API एक्सेस के साथ DTDC से मिलती है। एन्क्रिप्ट करके रखी जाती है।',
        },
        customerCode: {
          label: 'Customer code',
          help: 'आपका DTDC customer code, जैसे GL1234।',
        },
        originPincode: {
          label: 'भेजने का PIN कोड',
          help: 'वह 6 अंकों का PIN जहाँ से पार्सल जाते हैं। इससे कनेक्शन की जाँच होती है।',
        },
        trackingUsername: {
          label: 'ट्रैकिंग यूज़रनेम',
          help: 'DTDC की ट्रैकिंग सेवा का अपना लॉगिन होता है, जो API key के साथ आता है।',
        },
        trackingPassword: {
          label: 'ट्रैकिंग पासवर्ड',
          help: 'एन्क्रिप्ट करके रखा जाता है।',
        },
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint:
        'हम DTDC से API key और ट्रैकिंग लॉगिन जाँचते हैं, और यह कि DTDC आपके भेजने वाले PIN पर सेवा देता है। कुछ बुक नहीं होता।',
      advanced: {
        trigger: 'एडवांस्ड',
        baseUrlLabel: 'API base URL',
        baseUrlHelp: 'ऊपर के टेस्ट/लाइव स्विच से अपने आप भरता है। प्रोडक्शन के लिए खाली छोड़ें।',
        serviceTypeLabel: 'सर्विस टाइप',
        serviceTypeHelp:
          'आपकी बुकिंग के लिए DTDC की सेवा का नाम, ठीक वैसा जैसा कॉन्ट्रैक्ट में है (जैसे B2C PRIORITY या GROUND EXPRESS)। खाली रहने पर B2C PRIORITY बुक होती है।',
      },
      rateLimited: 'बहुत सारी कोशिशें हो गईं। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'DTDC',
      subtitle: 'आपके DTDC अकाउंट पर डिलीवरी जाँच, लेबल के साथ बुकिंग, ट्रैकिंग और रद्द करना।',
      notConnected: 'अभी जुड़ा नहीं है। शिपमेंट बुक करने के लिए अपने अकाउंट की जानकारी डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा है',
      connectedAndTested: 'जुड़ा है ✓ जाँचा गया',
      goToShipments: 'Shipments खोलें',
      goToShipmentsHelp: 'Orders → Shipments से हर DTDC शिपमेंट बुक करें, ट्रैक करें और संभालें।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'देखें कि PIN पर डिलीवरी और कैश ऑन डिलीवरी होती है या नहीं',
        create_shipment: 'कंसाइनमेंट बुक करें, प्रीपेड या कैश ऑन डिलीवरी',
        label: 'DTDC का लेबल छापें (शिपमेंट के साथ रखा जाता है)',
        tracking: 'दिन में कुछ बार अपने आप ट्रैकिंग',
        cancel: 'पिकअप से पहले बुकिंग रद्द करें',
      },
      notYetSupported: 'DTDC के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'बुकिंग से पहले कूरियर रेट (DTDC का रेट API नहीं है; चेकआउट आपके शिपिंग रेट से चलता है)',
        'ऐप से पिकअप तय करना (DTDC आपके अकाउंट के रोज़ के पिकअप पर पार्सल उठाता है)',
        'ऐप से डिलीवरी न हो पाने (NDR) पर कार्रवाई: शिपमेंट पर दिखता है, कार्रवाई DTDC के साथ करें',
      ],
    },
  }),
]
