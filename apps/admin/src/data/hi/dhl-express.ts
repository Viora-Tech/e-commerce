import { dhlExpressAppContent } from '@/data/dhl-express'
import { translation } from '@/lib/i18n'

export default [
  translation(dhlExpressAppContent, {
    connect: {
      title: 'DHL Express जोड़ें',
      intro: 'अपने DHL Express अकाउंट से विदेश में ऑर्डर भेजें। तीन स्टेप, करीब पाँच मिनट।',
      dashboardUrl: 'https://developer.dhl.com/api-reference/dhl-express-mydhl-api',
      signupUrl: 'https://mydhl.express.dhl/in/en/home.html',
      openDashboard: 'DHL डेवलपर पोर्टल खोलें',
      noAccount: 'DHL Express अकाउंट नहीं है?',
      signUp: 'खोलें',
      steps: {
        one: {
          title: 'DHL से MyDHL API एक्सेस माँगें',
          body: 'developer.dhl.com पर साइन इन करें, एक ऐप बनाएँ और उसमें "DHL Express - MyDHL API" जोड़ें। टेस्ट कुंजियाँ तुरंत मिलती हैं; लाइव कुंजियाँ आपके DHL अकाउंट मैनेजर की मंज़ूरी के बाद।',
        },
        two: {
          title: 'API key और secret कॉपी करें',
          body: 'developer.dhl.com पर ऐप खोलें और उसकी API key और API secret कॉपी करें। आपको अपना 9 अंकों का DHL Express अकाउंट नंबर भी चाहिए।',
          warning: 'टेस्ट कुंजियाँ सिर्फ़ Test मोड में चलती हैं, लाइव कुंजियाँ सिर्फ़ Live मोड में।',
        },
        three: {
          title: 'नीचे डालें और एक्सपोर्ट की जानकारी जोड़ें',
          body: 'जहाँ से पार्सल निकलते हैं उसका PIN कोड और शहर डालें, और कस्टम्स इनवॉइस के लिए अपना IEC। फिर "कनेक्शन जाँचें" दबाएँ।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n: number) => `स्टेप ${n}`,
      fields: {
        apiKey: { label: 'API key', help: 'developer.dhl.com पर आपके ऐप से।' },
        apiSecret: { label: 'API secret', help: 'API key के पास दिखता है। एन्क्रिप्ट करके रखा जाता है।' },
        accountNumber: {
          label: 'DHL अकाउंट नंबर',
          help: 'आपका 9 अंकों का DHL Express शिपर अकाउंट। शिपमेंट का बिल इसी पर आता है।',
        },
        originPincode: {
          label: 'भेजने का PIN कोड',
          help: 'वह 6 अंकों का PIN कोड जहाँ से आपके पार्सल निकलते हैं।',
        },
        originCity: {
          label: 'भेजने का शहर',
          help: 'उस PIN कोड का शहर। रेट बताने के लिए DHL को दोनों चाहिए।',
        },
        iec: {
          label: 'IEC (इम्पोर्टर-एक्सपोर्टर कोड)',
          help: 'DGFT से मिला आपका 10 अक्षरों का कोड, जो कमर्शियल इनवॉइस पर छपता है। कमर्शियल एक्सपोर्ट क्लियर करने के लिए भारतीय कस्टम्स को यह चाहिए।',
        },
      },
      mode: {
        label: 'मोड',
        test: 'टेस्ट',
        live: 'लाइव',
        help: {
          test: 'DHL का sandbox चल रहा है: कोई असली पार्सल नहीं, कोई चार्ज नहीं। ट्रैकिंग सिर्फ़ DHL के अपने टेस्ट वेबिल पर चलती है।',
          live: 'आपका लाइव DHL Express अकाउंट चल रहा है। असली शिपमेंट और असली चार्ज।',
        },
      },
      pickup: {
        label: 'हर शिपमेंट के साथ DHL पिकअप बुक करें',
        help: 'जिस दिन आप बुक करते हैं, DHL उसी दिन पिकअप पते से पार्सल ले जाता है। अगर आप पार्सल DHL पॉइंट पर छोड़ते हैं या रोज़ का पिकअप है तो बंद करें।',
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint:
        'हम DHL पर सिर्फ़ पढ़ने वाली पते की जाँच से आपकी कुंजियाँ परखते हैं। कुछ बुक नहीं होता, और अकाउंट नंबर पहली बुकिंग पर जाँचा जाता है।',
      rateLimited: 'बहुत ज़्यादा कोशिशें हो गईं। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'DHL Express',
      subtitle: 'विदेश में ऑर्डर भेजें: DHL रेट, कमर्शियल इनवॉइस के साथ लेबल, पिकअप और ट्रैकिंग।',
      notConnected: 'अभी जुड़ा नहीं है। विदेश में भेजना शुरू करने के लिए अपनी DHL Express कुंजियाँ डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा है',
      connectedAndTested: 'जुड़ा है ✓ जाँचा गया',
      goToShipments: 'Shipments वर्कस्पेस खोलें',
      goToShipmentsHelp:
        'विदेश जाने वाले ऑर्डर पर Create shipment में DHL Express के रेट दिखते हैं। देश के अंदर के ऑर्डर आपके भारतीय कूरियर से ही जाते हैं।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'जाँचें कि DHL ग्राहक के देश और पोस्टल कोड तक पहुँचाता है',
        rates: 'DHL Express की सेवाओं की कीमत और लगने वाले दिन रुपये में मिलाएँ',
        create_shipment: 'आपके प्रोडक्ट से भरी कस्टम्स लाइनों के साथ शिपमेंट बुक करें',
        label: 'लेबल और कमर्शियल इनवॉइस एक ही PDF में छापें',
        tracking: 'शिपमेंट ट्रैक करें (तय समय पर जाँच - DHL webhook नहीं भेजता)',
        cancel: 'जो पार्सल अभी निकला नहीं, उसका पिकअप रद्द करें',
        international: 'भारत से एक्सपोर्ट, इनवॉइस पर HS कोड, बनने का देश, GSTIN और IEC के साथ',
      },
      notYetSupported: 'DHL Express के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'भारत के अंदर के पार्सल (DHL Express इन्हें नहीं ले जाता)',
        'ड्यूटी आपकी ओर से (DDP): इम्पोर्ट ड्यूटी ग्राहक भरता है',
        'कैश ऑन डिलीवरी',
      ],
      copied: 'कॉपी हो गया',
    },
  }),
]
