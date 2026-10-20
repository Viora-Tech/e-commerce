import { indiaPostAppContent } from '@/data/india-post'
import { translation, untranslated } from '@/lib/i18n'

export default [
  translation(indiaPostAppContent, {
    connect: {
      title: 'India Post सेट करें',
      intro:
        'ऑनलाइन दुकानों के लिए India Post की कोई बुकिंग API नहीं है, इसलिए हर पार्सल आप डाकघर में बुक करते हैं और बाकी हम करते हैं: रेट, लेबल और स्टेटस।',
      dashboardUrl: untranslated,
      signupUrl: untranslated,
      openDashboard: 'India Post खोलें',
      noAccount: 'कॉन्ट्रैक्ट रेट और COD चाहिए?',
      signUp: 'India Post से बिज़नेस अकाउंट के बारे में पूछें',
      steps: {
        one: {
          title: 'अपना डाकघर चुनें',
          body: 'उस डाकघर का पिनकोड डालें जहाँ आप पार्सल देते हैं। रेट और डिलीवरी का समय इसी से निकलता है।',
        },
        two: {
          title: 'बिज़नेस अकाउंट हो तो जोड़ें',
          body: 'India Post के बिज़नेस (BNPL) कस्टमर ID से कॉन्ट्रैक्ट रेट मिलते हैं और कैश ऑन डिलीवरी ले सकते हैं। इसके बिना काउंटर रेट लगते हैं और हर पार्सल प्रीपेड होता है।',
        },
        three: {
          title: 'टेस्ट करें और सेव करें',
          body: 'पिनकोड जाँचने के लिए "कनेक्शन टेस्ट करें" दबाएँ, फिर सेव करें। किसी भी ऑर्डर से "शिपमेंट बनाएं" में पार्सल बुक करें।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n) => `चरण ${n}`,
      fields: {
        originPincode: {
          label: 'डाकघर का पिनकोड',
          help: 'जहाँ आप पार्सल बुक करते हैं। 6 अंक।',
        },
        customerId: {
          label: 'Speed Post कस्टमर ID',
          help: 'ज़रूरी नहीं। आपका India Post बिज़नेस (BNPL) कस्टमर ID; लेबल पर छपता है।',
        },
        contractRates: {
          label: 'मेरे पास कॉन्ट्रैक्ट रेट हैं',
          help: 'काउंटर रेट की जगह India Post के कॉन्ट्रैक्ट रेट कार्ड से कीमत लगाएँ।',
        },
        codEnabled: {
          label: 'कैश ऑन डिलीवरी लें',
          help: 'तभी, जब आपका India Post बिज़नेस अकाउंट आपके लिए COD लेता है।',
        },
        codFeeRupees: {
          label: 'हर पार्सल का COD शुल्क (₹)',
          help: 'हर COD पार्सल पर India Post आपसे जितना लेता है, आपके एग्रीमेंट के अनुसार।',
        },
        dataGovApiKey: {
          label: 'data.gov.in API कुंजी',
          help: 'ज़रूरी नहीं और मुफ़्त: data.gov.in पर साइन अप करके अपनी कुंजी कॉपी करें। इससे हर पिनकोड का डाकघर दिखता है।',
        },
      },
      testConnection: 'कनेक्शन टेस्ट करें',
      testing: 'टेस्ट हो रहा है…',
      testHint:
        'हम पिनकोड को India Post की डायरेक्टरी से जाँचते हैं। कुछ बुक नहीं होता और India Post अकाउंट की ज़रूरत नहीं।',
      advanced: {
        trigger: 'अपने रेट',
        tariffLabel: 'रेट कार्ड (JSON)',
        tariffHelp:
          'खाली छोड़ें तो India Post का प्रकाशित टैरिफ़ (1 अगस्त 2026 से लागू) लगेगा। अपना तय किया कार्ड इसी ढाँचे में डालें: वज़न की स्लैब, local, withinState, metro और otherStates के रुपये, और additionalKgRupees।',
      },
      rateLimited: 'बहुत बार कोशिश हुई। कुछ मिनट रुककर फिर करें।',
    },
    overview: {
      title: 'India Post',
      subtitle: 'भारत के हर पिनकोड तक Speed Post पार्सल, आपके डाकघर से बुक।',
      notConnected: 'अभी सेट नहीं है। शुरू करने के लिए डाकघर का पिनकोड डालें।',
      connectCta: 'India Post सेट करें',
      connected: 'तैयार',
      connectedAndTested: 'तैयार ✓ टेस्ट हो गया',
      goToShipments: 'शिपमेंट वर्कस्पेस खोलें',
      goToShipmentsHelp:
        'किसी भी ऑर्डर से पार्सल बुक करें: "शिपमेंट बनाएं" में India Post चुनें और रसीद का आर्टिकल नंबर डालें।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'भारत का कोई भी पिनकोड जाँचें, उसके डाकघर और India Post के डिलीवरी समय के साथ',
        rates: 'India Post के प्रकाशित टैरिफ़ से, या आपके अपने कार्ड से Speed Post रेट',
        create_shipment: 'आर्टिकल नंबर से पार्सल दर्ज करें, हर अंक जाँचकर',
        label: 'बारकोड वाला पते का लेबल छापें',
        cancel: 'अपने रिकॉर्ड में पार्सल रद्द करें ताकि फिर से बुक हो सके',
      },
      notYetSupported: 'India Post के लिए उपलब्ध नहीं',
      notYetSupportedItems: [
        'यहीं से बुकिंग: India Post की बुकिंग API सिर्फ़ कॉन्ट्रैक्ट वाले बल्क ग्राहकों के लिए है',
        'अपने-आप ट्रैकिंग: हर पार्सल का स्टेटस नीचे indiapost.gov.in देखकर बदलें',
      ],
    },
    parcels: {
      heading: 'रास्ते में पार्सल',
      help: 'India Post हमें ट्रैकिंग नहीं भेजता, इसलिए हर पार्सल का स्टेटस यहाँ बदलें। डिलीवर होने पर ऑर्डर पूरा होता है; लौटने पर RTO शुरू होता है।',
      empty: 'रास्ते में कोई India Post पार्सल नहीं।',
      loadFailed: 'आपके पार्सल लोड नहीं हो पाए।',
      order: (n) => `ऑर्डर #${n}`,
      status: 'स्टेटस',
      update: 'बदलें',
      saving: 'सेव हो रहा है…',
      saved: 'स्टेटस बदल गया',
      track: 'India Post पर ट्रैक करें',
      trackHelp: 'India Post का ट्रैकर खाली खुलता है: वहाँ आर्टिकल नंबर डालें।',
      label: 'लेबल',
      copyNumber: 'आर्टिकल नंबर',
      statuses: {
        created: 'बुक हुआ',
        picked_up: 'डाकघर में दिया',
        in_transit: 'रास्ते में',
        out_for_delivery: 'डिलीवरी के लिए निकला',
        delivered: 'डिलीवर हुआ',
        rto: 'आपके पास लौटा',
      },
    },
    label: {
      title: (n) => `लेबल ${n}`,
      loading: 'लेबल बन रहा है…',
      failed: 'लेबल नहीं बन पाया।',
      download: 'PDF डाउनलोड करें',
      print: 'प्रिंट करें',
      back: 'पार्सल पर वापस',
    },
  }),
]
