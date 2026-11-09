import { shipglobalAppContent } from '@/data/shipglobal'
import { translation } from '@/lib/i18n'

export default [
  translation(shipglobalAppContent, {
    connect: {
      title: 'ShipGlobal जोड़ें',
      intro: 'अपने ShipGlobal अकाउंट से विदेश में ऑर्डर भेजें। तीन स्टेप, करीब पाँच मिनट।',
      dashboardUrl: 'https://v2.app.shipglobal.in/auth/login',
      signupUrl: 'https://v2.app.shipglobal.in/auth/signup',
      openDashboard: 'ShipGlobal खोलें',
      noAccount: 'ShipGlobal अकाउंट नहीं है?',
      signUp: 'साइन अप करें',
      steps: {
        one: {
          title: 'ShipGlobal में साइन इन करें',
          body: 'अपने ShipGlobal अकाउंट में साइन इन करें और उसकी KYC (GSTIN और IEC) पूरी करें, ताकि ShipGlobal आपके एक्सपोर्ट फ़ाइल कर सके।',
        },
        two: {
          title: 'API यूज़रनेम और पासवर्ड कॉपी करें',
          body: 'ShipGlobal में Settings › API खोलें और API यूज़रनेम और API पासवर्ड कॉपी करें। API सेक्शन न दिखे तो ShipGlobal सपोर्ट से पूछें।',
          warning:
            'ShipGlobal के API में टेस्ट मोड नहीं है: हर बुकिंग असली लेबल है, जिसका पैसा आपके ShipGlobal वॉलेट से कटता है।',
        },
        three: {
          title: 'नीचे डालें और एक्सपोर्ट की जानकारी जोड़ें',
          body: 'जहाँ से पार्सल निकलते हैं उसका PIN कोड और शहर, अपना IEC और डिफ़ॉल्ट सर्विस डालें। फिर "कनेक्शन जाँचें" दबाएँ।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n) => `स्टेप ${n}`,
      fields: {
        username: { label: 'API यूज़रनेम', help: 'ShipGlobal › Settings › API से।' },
        password: {
          label: 'API पासवर्ड',
          help: 'API यूज़रनेम के पास दिखता है। एन्क्रिप्ट करके रखा जाता है।',
        },
        addressNickname: {
          label: 'पिकअप पते का निकनेम',
          help: 'वैकल्पिक। ShipGlobal में सेव किए पिकअप पते का निकनेम। खाली छोड़ें तो डिफ़ॉल्ट पता इस्तेमाल होगा।',
        },
        customerNickname: {
          label: 'कस्टमर निकनेम',
          help: 'सिर्फ़ फ़्रैंचाइज़ी अकाउंट के लिए, जैसा ShipGlobal ने दिया। नहीं तो खाली छोड़ें।',
        },
        originPincode: {
          label: 'ओरिजिन PIN कोड',
          help: 'जहाँ से आपके पार्सल निकलते हैं, उसका 6 अंकों का PIN कोड।',
        },
        originCity: { label: 'ओरिजिन शहर', help: 'उस PIN कोड का शहर।' },
        iec: {
          label: 'IEC (Importer-Exporter Code)',
          help: 'DGFT से मिला आपका 10 अक्षरों का कोड। कमर्शियल एक्सपोर्ट क्लियर करने के लिए भारतीय कस्टम्स को इसकी ज़रूरत है।',
        },
        iossNumber: {
          label: 'IOSS नंबर',
          help: 'वैकल्पिक। EU जाने वाले पार्सल के लिए, अगर आप IOSS में रजिस्टर्ड हैं।',
        },
        service: {
          label: 'डिफ़ॉल्ट सर्विस',
          help: 'तब बुक होती है जब आप Create shipment में लाइव रेट से कोई सर्विस नहीं चुनते।',
        },
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint: 'हम इस लॉगिन से ShipGlobal से एक सैंपल रेट माँगते हैं। कुछ बुक नहीं होता, कोई पैसा नहीं कटता।',
      rateLimited: 'बहुत सारी कोशिशें। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'ShipGlobal',
      subtitle:
        'ShipGlobal से विदेश में ऑर्डर भेजें: लाइव रेट, कस्टम्स लाइनों के साथ एक्सपोर्ट बुकिंग, लेबल और ट्रैकिंग।',
      notConnected:
        'अभी जुड़ा नहीं है। विदेश भेजना शुरू करने के लिए अपना ShipGlobal API यूज़रनेम और पासवर्ड डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा हुआ',
      connectedAndTested: 'जुड़ा हुआ ✓ जाँचा गया',
      goToShipments: 'शिपमेंट वर्कस्पेस खोलें',
      goToShipmentsHelp:
        'विदेश जाने वाले ऑर्डर Create shipment में ShipGlobal की हर सर्विस उसके लाइव दाम के साथ दिखाते हैं। देश के अंदर के ऑर्डर आपके भारतीय कूरियर से ही जाते हैं।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'विदेश जाने वाले ऑर्डर के लिए ShipGlobal दिखाएँ',
        rates: 'ShipGlobal की हर सर्विस का लाइव दाम और डिलीवरी समय',
        create_shipment: 'आपके प्रोडक्ट्स से भरी कस्टम्स लाइनों के साथ एक्सपोर्ट बुक करें',
        label: 'ShipGlobal वॉलेट से लेबल का पैसा दें और ऑर्डर से प्रिंट करें',
        tracking: 'ऑर्डर पर ट्रैकिंग अपडेट, अपने-आप',
        cancel: 'यहीं से लेबल कैंसल करें, पैसा ShipGlobal वॉलेट में वापस',
        international: 'भारत से एक्सपोर्ट, हर ऑर्डर के साथ HS कोड और IOSS',
      },
      notYetSupported: 'ShipGlobal के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: ['पिकअप: ShipGlobal में बुक करें', 'देश के अंदर के पार्सल और कैश ऑन डिलीवरी'],
      copied: 'कॉपी हो गया',
    },
  }),
]
