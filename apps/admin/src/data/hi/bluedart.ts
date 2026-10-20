import { bluedartAppContent } from '@/data/bluedart'
import { translation } from '@/lib/i18n'

export default [
  translation(bluedartAppContent, {
    connect: {
      title: 'Blue Dart जोड़ें',
      intro:
        'अपना Blue Dart अकाउंट जोड़ने के लिए नीचे के तीन कदम पूरे करें। इसके लिए पहले Blue Dart से API एक्सेस चाहिए।',
      dashboardUrl: 'https://developer.dhl.com/',
      signupUrl: 'https://www.bluedart.com/',
      openDashboard: 'DHL डेवलपर पोर्टल खोलें',
      noAccount: 'Blue Dart का बिज़नेस अकाउंट नहीं है?',
      signUp: 'Blue Dart से संपर्क करें',
      steps: {
        one: {
          title: 'DHL डेवलपर पोर्टल पर ऐप बनाएं',
          body: 'Blue Dart का API Gateway developer.dhl.com पर है। साइन इन करें, My Apps खोलें और Blue Dart APIs (Waybill, Pickup, Tracking, Location Finder, Transit Time) के साथ एक ऐप बनाएं।',
        },
        two: {
          title: 'Client ID, secret और अपनी Blue Dart जानकारी कॉपी करें',
          body: 'ऐप में Consumer Key (Client ID) और secret दिखते हैं। Login ID, licence key, customer code और भेजने वाले PIN का area code आपके Blue Dart अकाउंट मैनेजर देते हैं।',
          warning:
            'Licence key आपके customer code से जुड़ी होती है। किसी दूसरे Blue Dart अकाउंट की key से शिपमेंट उसी अकाउंट पर बुक होंगे।',
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
          test: 'Blue Dart का sandbox इस्तेमाल हो रहा है। sandbox की keys डालें, लाइव keys यहाँ नहीं चलतीं।',
          live: 'आपका लाइव Blue Dart अकाउंट इस्तेमाल हो रहा है। असली वेबिल और असली चार्ज।',
        },
      },
      fields: {
        clientId: {
          label: 'Client ID',
          help: 'DHL डेवलपर पोर्टल → My Apps → आपका ऐप → Consumer Key।',
        },
        clientSecret: {
          label: 'Client secret',
          help: 'Client ID के पास दिखता है। एन्क्रिप्ट करके रखा जाता है।',
        },
        loginId: {
          label: 'Login ID',
          help: 'API एक्सेस के साथ Blue Dart से मिलता है।',
        },
        licenceKey: {
          label: 'Licence key',
          help: 'API एक्सेस के साथ Blue Dart से मिलती है। एन्क्रिप्ट करके रखी जाती है।',
        },
        customerCode: {
          label: 'Customer code',
          help: 'आपका Blue Dart बिलिंग customer code।',
        },
        originArea: {
          label: 'भेजने का area code',
          help: 'जिस PIN से पार्सल जाते हैं उसका Blue Dart का 3 अक्षर वाला area code, जैसे DEL या BOM। पक्का न हो तो अकाउंट मैनेजर से पूछें।',
        },
        originPincode: {
          label: 'भेजने का PIN कोड',
          help: 'वह 6 अंकों का PIN जहाँ से पार्सल जाते हैं। इससे कनेक्शन की जाँच और डिलीवरी की तारीख का अनुमान होता है।',
        },
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint:
        'हम Blue Dart में साइन इन करके आपका भेजने का PIN देखते हैं, कुछ बुक नहीं होता। Area code की जाँच वेबिल बुक करते समय ही होती है।',
      advanced: {
        trigger: 'एडवांस्ड',
        baseUrlLabel: 'API base URL',
        baseUrlHelp: 'ऊपर के टेस्ट/लाइव स्विच से अपने आप भरता है। प्रोडक्शन के लिए खाली छोड़ें।',
        surfaceLabel: 'Apex (हवाई) की जगह Surface बुक करें',
        surfaceHelp: 'बंद रहने पर Apex, Blue Dart की हवाई सेवा, बुक होती है। Surface धीमी और सस्ती है।',
        registerPickupLabel: 'हर वेबिल के साथ पिकअप दर्ज करें',
        registerPickupHelp:
          'चालू: बुक करते ही Blue Dart से हर पार्सल उठाने को कहा जाता है। बंद: Shipments से खुद पिकअप तय करें।',
        pickupAddressLabel: 'पिकअप पता',
        pickupAddressHelp: 'Shipments से पिकअप तय करने पर Blue Dart यहीं से पार्सल उठाता है।',
        pickupPhoneLabel: 'पिकअप फ़ोन',
        pickupPhoneHelp: 'वह नंबर जिस पर Blue Dart का पिकअप कर्मचारी फ़ोन करता है।',
      },
      rateLimited: 'बहुत सारी कोशिशें हो गईं। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'Blue Dart',
      subtitle: 'आपके Blue Dart अकाउंट पर डिलीवरी जाँच, लेबल के साथ वेबिल, पिकअप और ट्रैकिंग।',
      notConnected: 'अभी जुड़ा नहीं है। शिपमेंट बुक करने के लिए अपने अकाउंट की जानकारी डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा है',
      connectedAndTested: 'जुड़ा है ✓ जाँचा गया',
      goToShipments: 'Shipments खोलें',
      goToShipmentsHelp: 'Orders → Shipments से हर Blue Dart शिपमेंट बुक करें, ट्रैक करें और संभालें।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'देखें कि PIN पर डिलीवरी होती है या नहीं, Blue Dart की अनुमानित तारीख के साथ',
        create_shipment: 'वेबिल बुक करें, प्रीपेड या कैश ऑन डिलीवरी',
        label: 'Blue Dart का लेबल छापें (शिपमेंट के साथ रखा जाता है)',
        pickup: 'हर बुकिंग के साथ पिकअप दर्ज करें, या Shipments से तय करें',
        tracking: 'दिन में कुछ बार अपने आप ट्रैकिंग',
        cancel: 'पिकअप से पहले वेबिल रद्द करें',
      },
      notYetSupported: 'Blue Dart के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'बुकिंग से पहले कूरियर रेट (Blue Dart का रेट API नहीं है; चेकआउट आपके शिपिंग रेट से चलता है)',
        'ऐप से डिलीवरी न हो पाने (NDR) पर कार्रवाई: शिपमेंट पर दिखता है, कार्रवाई Blue Dart के साथ करें',
        'वेबहुक से तुरंत ट्रैकिंग (Blue Dart इसे हर अकाउंट के लिए अलग से चालू करता है; ऐप तय समय पर जाँचता है)',
      ],
    },
  }),
]
