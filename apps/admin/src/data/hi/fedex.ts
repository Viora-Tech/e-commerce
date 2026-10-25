import { fedexAppContent } from '@/data/fedex'
import { translation } from '@/lib/i18n'

export default [
  translation(fedexAppContent, {
    connect: {
      title: 'FedEx जोड़ें',
      intro: 'अपने FedEx अकाउंट से विदेश में ऑर्डर भेजें। तीन स्टेप, करीब पाँच मिनट।',
      dashboardUrl: 'https://developer.fedex.com/api/en-in/home.html',
      signupUrl: 'https://www.fedex.com/en-in/open-account.html',
      openDashboard: 'FedEx डेवलपर पोर्टल खोलें',
      noAccount: 'FedEx अकाउंट नहीं है?',
      signUp: 'खोलें',
      steps: {
        one: {
          title: 'FedEx API प्रोजेक्ट बनाएँ',
          body: 'developer.fedex.com पर साइन इन करें, एक प्रोजेक्ट बनाएँ और Ship, Rate, Pickup Request और Track चुनें। अपना FedEx शिपिंग अकाउंट उससे जोड़ें।',
        },
        two: {
          title: 'API key और secret key कॉपी करें',
          body: 'प्रोजेक्ट में टेस्ट कुंजियाँ तुरंत दिखती हैं; प्रोडक्शन कुंजियाँ FedEx की मंज़ूरी के बाद। आपको अपना 9 अंकों का FedEx अकाउंट नंबर भी चाहिए।',
          warning: 'टेस्ट कुंजियाँ सिर्फ़ Test मोड में चलती हैं, प्रोडक्शन कुंजियाँ सिर्फ़ Live मोड में।',
        },
        three: {
          title: 'नीचे डालें और एक्सपोर्ट की जानकारी जोड़ें',
          body: 'जहाँ से पार्सल निकलते हैं उसका PIN कोड और शहर डालें, और कस्टम्स इनवॉइस के लिए अपना IEC। फिर "कनेक्शन जाँचें" दबाएँ।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n: number) => `स्टेप ${n}`,
      fields: {
        clientId: { label: 'API key', help: 'developer.fedex.com पर आपके प्रोजेक्ट से।' },
        clientSecret: {
          label: 'Secret key',
          help: 'API key के पास दिखती है। एन्क्रिप्ट करके रखी जाती है।',
        },
        accountNumber: {
          label: 'FedEx अकाउंट नंबर',
          help: 'वह 9 अंकों का अकाउंट जिस पर शिपमेंट का बिल आता है।',
        },
        originPincode: {
          label: 'भेजने का PIN कोड',
          help: 'वह 6 अंकों का PIN कोड जहाँ से आपके पार्सल निकलते हैं।',
        },
        originCity: { label: 'भेजने का शहर', help: 'उस PIN कोड का शहर।' },
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
          test: 'FedEx का sandbox चल रहा है: कोई असली पार्सल नहीं, कोई चार्ज नहीं।',
          live: 'आपका लाइव FedEx अकाउंट चल रहा है। असली शिपमेंट और असली चार्ज।',
        },
      },
      pickup: {
        label: 'हर बुकिंग के बाद FedEx पिकअप माँगें',
        help: 'दोपहर 3 बजे से पहले बुक करें तो FedEx उसी दिन ले जाता है; बाद में, अगले दिन सुबह 10 बजे से। अगर आप पार्सल FedEx पर छोड़ते हैं या नियमित पिकअप है तो बंद करें।',
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint:
        'हम FedEx से साइन-इन टोकन माँगकर आपकी API key और secret परखते हैं। कुछ बुक नहीं होता, और अकाउंट नंबर पहले रेट या बुकिंग पर जाँचा जाता है।',
      rateLimited: 'बहुत ज़्यादा कोशिशें हो गईं। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'FedEx',
      subtitle: 'विदेश में ऑर्डर भेजें: FedEx रेट, कमर्शियल इनवॉइस के साथ लेबल, पिकअप, ट्रैकिंग और रद्द करना।',
      notConnected: 'अभी जुड़ा नहीं है। विदेश में भेजना शुरू करने के लिए अपनी FedEx कुंजियाँ डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा है',
      connectedAndTested: 'जुड़ा है ✓ जाँचा गया',
      goToShipments: 'Shipments वर्कस्पेस खोलें',
      goToShipmentsHelp:
        'विदेश जाने वाले ऑर्डर पर Create shipment में FedEx के रेट दिखते हैं। देश के अंदर के ऑर्डर आपके भारतीय कूरियर से ही जाते हैं।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'जाँचें कि FedEx ग्राहक के देश और पोस्टल कोड तक पहुँचाता है',
        rates: 'FedEx की सेवाओं की कीमत और लगने वाले दिन रुपये में मिलाएँ',
        create_shipment: 'आपके प्रोडक्ट से भरी कस्टम्स लाइनों के साथ शिपमेंट बुक करें',
        label: 'लेबल और कमर्शियल इनवॉइस एक ही PDF में छापें',
        tracking: 'शिपमेंट ट्रैक करें (तय समय पर जाँच)',
        cancel: 'FedEx के ले जाने से पहले शिपमेंट रद्द करें',
        international: 'भारत से एक्सपोर्ट, इनवॉइस पर HS कोड, बनने का देश, GSTIN और IEC के साथ',
      },
      notYetSupported: 'FedEx के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'भारत के अंदर के पार्सल (FedEx अब इन्हें नहीं ले जाता)',
        'ड्यूटी आपकी ओर से (DDP): इम्पोर्ट ड्यूटी ग्राहक भरता है',
        'कैश ऑन डिलीवरी',
      ],
      copied: 'कॉपी हो गया',
    },
  }),
]
