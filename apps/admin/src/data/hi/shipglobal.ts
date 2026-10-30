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
          title: 'API लॉगिन कॉपी करें',
          body: 'ShipGlobal में Settings › API खोलें और API लॉगिन (ईमेल) और API पासवर्ड कॉपी करें। API सेक्शन न दिखे तो ShipGlobal सपोर्ट से पूछें।',
          warning: 'ShipGlobal के API में टेस्ट मोड नहीं है: हर बुकिंग असली लेबल है।',
        },
        three: {
          title: 'नीचे डालें और एक्सपोर्ट की जानकारी जोड़ें',
          body: 'अपना सेलर निकनेम, जहाँ से पार्सल निकलते हैं उसका PIN कोड और शहर, अपना IEC और बुक करने वाली सर्विस डालें। फिर "कनेक्शन जाँचें" दबाएँ।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n) => `स्टेप ${n}`,
      fields: {
        email: { label: 'API लॉगिन (ईमेल)', help: 'ShipGlobal › Settings › API से।' },
        password: {
          label: 'API पासवर्ड',
          help: 'API लॉगिन के पास दिखता है। एन्क्रिप्ट करके रखा जाता है।',
        },
        sellerNickname: {
          label: 'सेलर निकनेम',
          help: 'ShipGlobal पर आपका सेलर नाम, हर ऑर्डर के साथ जाता है। पक्का न हो तो अपने स्टोर का नाम।',
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
          label: 'सर्विस',
          help: 'विदेश में आपके पार्सल कौन पहुँचाता है। USPS और UPS सिर्फ़ US जाते हैं: 5 kg तक USPS, उससे ऊपर UPS।',
        },
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint:
        'हम इस API लॉगिन से ShipGlobal में साइन इन करते हैं। कुछ बुक नहीं होता, और सेलर की जानकारी पहली बुकिंग पर जाँची जाती है।',
      rateLimited: 'बहुत सारी कोशिशें। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'ShipGlobal',
      subtitle: 'ShipGlobal से विदेश में ऑर्डर भेजें: कस्टम्स लाइनों के साथ एक्सपोर्ट बुकिंग, और लेबल।',
      notConnected: 'अभी जुड़ा नहीं है। विदेश भेजना शुरू करने के लिए अपना ShipGlobal API लॉगिन डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा हुआ',
      connectedAndTested: 'जुड़ा हुआ ✓ जाँचा गया',
      goToShipments: 'शिपमेंट वर्कस्पेस खोलें',
      goToShipmentsHelp:
        'विदेश जाने वाले ऑर्डर Create shipment में ShipGlobal दिखाते हैं, दाम बुकिंग पर। देश के अंदर के ऑर्डर आपके भारतीय कूरियर से ही जाते हैं।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'जाँचें कि आपकी ShipGlobal सर्विस ग्राहक के देश तक जाती है',
        create_shipment: 'आपके प्रोडक्ट्स से भरी कस्टम्स लाइनों के साथ एक्सपोर्ट बुक करें',
        label: 'ऑर्डर से लेबल प्रिंट करें',
        international: 'भारत से एक्सपोर्ट, हर ऑर्डर के साथ HS कोड, GSTIN, IEC और IOSS',
      },
      notYetSupported: 'ShipGlobal के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'लाइव रेट: ShipGlobal के API में रेट नहीं है, दाम ShipGlobal में बुकिंग के बाद दिखता है',
        'अपने-आप ट्रैकिंग: हर पार्सल का स्टेटस नीचे बदलें',
        'यहाँ से कैंसल: लेबल अपने ShipGlobal पैनल में कैंसल करें',
        'पिकअप: ShipGlobal में बुक करें',
        'देश के अंदर के पार्सल और कैश ऑन डिलीवरी',
      ],
      copied: 'कॉपी हो गया',
    },
    parcels: {
      heading: 'रास्ते में पार्सल',
      help: 'ShipGlobal हमें ट्रैकिंग नहीं भेजता, इसलिए हर पार्सल का स्टेटस यहाँ बदलें। डिलीवर होने पर ऑर्डर पूरा होता है; लौटने पर RTO शुरू होता है।',
      empty: 'रास्ते में कोई ShipGlobal पार्सल नहीं।',
      loadFailed: 'आपके पार्सल लोड नहीं हो पाए।',
      order: (n) => `ऑर्डर #${n}`,
      status: 'स्टेटस',
      update: 'बदलें',
      saving: 'सेव हो रहा है…',
      saved: 'स्टेटस बदल गया',
      track: 'ShipGlobal पर ट्रैक करें',
      trackHelp: 'ShipGlobal का ट्रैकर खाली खुलता है: वहाँ ट्रैकिंग नंबर डालें।',
      label: 'लेबल',
      copyNumber: 'ट्रैकिंग नंबर',
      statuses: {
        created: 'बुक हुआ',
        picked_up: 'पिकअप हुआ',
        in_transit: 'रास्ते में',
        out_for_delivery: 'डिलीवरी के लिए निकला',
        delivered: 'डिलीवर हुआ',
        rto: 'आपके पास लौटा',
      },
    },
  }),
]
