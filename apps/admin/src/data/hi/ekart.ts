import { ekartAppContent } from '@/data/ekart'
import { translation } from '@/lib/i18n'

export default [
  translation(ekartAppContent, {
    connect: {
      title: 'Ekart जोड़ें',
      intro: 'अपना Ekart अकाउंट जोड़ने के लिए नीचे के तीन चरण पूरे करें। लगभग दो मिनट लगते हैं।',
      dashboardUrl: 'https://app.elite.ekartlogistics.in/',
      signupUrl: 'https://ekartlogistics.com/',
      openDashboard: 'Ekart खोलें',
      noAccount: 'Ekart अकाउंट नहीं है?',
      signUp: 'साइन अप करें',
      steps: {
        one: {
          title: 'अपने API क्रेडेंशियल ढूँढें',
          body: 'अकाउंट शुरू होने पर Ekart एक क्लाइंट ID, API यूज़रनेम और पासवर्ड ईमेल करता है। अगर ये नहीं हैं तो अपने Ekart अकाउंट मैनेजर से API एक्सेस माँगें।',
        },
        two: {
          title: 'अपने पिकअप पते का उपनाम नोट करें',
          body: 'Ekart डैशबोर्ड में Addresses खोलें और उस पते का उपनाम (alias) कॉपी करें जहाँ से पार्सल निकलते हैं। सिर्फ़ एक पता दर्ज है तो यह छोड़ सकते हैं।',
        },
        three: {
          title: 'इन्हें नीचे पेस्ट करें',
          body: 'फ़ील्ड भरें, फिर सेव करने से पहले "कनेक्शन जाँचें" से पक्का करें कि सब ठीक है।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n: number) => `चरण ${n}`,
      fields: {
        clientId: {
          label: 'क्लाइंट ID',
          help: 'आपके Ekart ऑनबोर्डिंग ईमेल से।',
        },
        username: {
          label: 'API यूज़रनेम',
          help: 'आपके Ekart ऑनबोर्डिंग ईमेल से; डैशबोर्ड का लॉगिन नहीं।',
        },
        password: {
          label: 'API पासवर्ड',
          help: 'एन्क्रिप्ट करके रखा जाता है और फिर कभी नहीं दिखाया जाता।',
        },
        originPincode: {
          label: 'भेजने का PIN कोड',
          help: 'वह 6 अंकों का PIN कोड जहाँ से पार्सल भेजे जाते हैं। इससे हम कनेक्शन जाँचते हैं और रेट की तुलना करते हैं।',
        },
        pickupAlias: {
          label: 'पिकअप पते का उपनाम',
          help: 'आपके दर्ज पिकअप पते का उपनाम (alias)। सिर्फ़ एक पता दर्ज है तो खाली छोड़ें।',
        },
        sellerName: {
          label: 'विक्रेता का नाम',
          help: 'आपके बिज़नेस का नाम, लेबल पर छपता है।',
        },
        sellerAddress: {
          label: 'विक्रेता का बिलिंग पता',
          help: 'आपका दर्ज बिलिंग पता, लेबल पर छपता है।',
        },
        sellerGstin: {
          label: 'विक्रेता का GSTIN',
          help: '15 अक्षर। GST में रजिस्टर्ड नहीं हैं तो खाली छोड़ें।',
        },
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint:
        'हम साइन इन करके आपका अपना PIN कोड देखकर यह जाँचते हैं। कुछ भी बुक नहीं होता। पिकअप उपनाम सिर्फ़ शिपमेंट बुक करते समय जाँचा जाता है।',
      advanced: {
        trigger: 'एडवांस्ड',
        baseUrlLabel: 'API बेस URL',
        baseUrlHelp: 'प्रोडक्शन के लिए खाली छोड़ें।',
        webhookSecretLabel: 'वेबहुक सीक्रेट',
        webhookSecretHelp:
          'अपने-आप ट्रैकिंग अपडेट के लिए ज़रूरी: 6 से 30 अक्षर। Ekart जब आपका track_updated वेबहुक दर्ज करे तो यही सीक्रेट इस्तेमाल करें; जो पुश इससे साइन न हो वह ठुकरा दिया जाता है।',
        webhookUrlLabel: 'ट्रैकिंग वेबहुक URL',
        webhookNeedsDomain:
          'वेबहुक तभी काम करते हैं जब आपका स्टोर किसी पब्लिक डोमेन पर लाइव हो; कूरियर localhost या प्रीव्यू URL तक नहीं पहुँच सकता।',
      },
      rateLimited: 'बहुत ज़्यादा कोशिशें हुईं। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'Ekart',
      subtitle: 'Ekart नेटवर्क पर रेट और डिलीवरी के दिन, बुकिंग, रिटर्न पिकअप, ट्रैकिंग और NDR।',
      notConnected: 'अभी जुड़ा नहीं है। शिपमेंट बुक करने के लिए अपने अकाउंट की जानकारी डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा है',
      connectedAndTested: 'जुड़ा है ✓ जाँचा गया',
      goToShipments: 'शिपमेंट वर्कस्पेस खोलें',
      goToShipmentsHelp: 'Orders → Shipments से हर Ekart शिपमेंट बुक करें, ट्रैक करें और संभालें।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'देखें कि PIN कोड पर डिलीवरी होती है या नहीं, COD और डिलीवरी के दिनों के साथ',
        rates: 'किसी पार्सल के लिए Ekart का दाम और डिलीवरी के दिन देखें',
        create_shipment: 'शिपमेंट बुक करें और Ekart ट्रैकिंग ID पाएं',
        tracking: 'दिन में कुछ बार स्कैन अपने-आप ट्रैक करें',
        webhook: 'वेबहुक चालू करने पर लगभग तुरंत ट्रैकिंग अपडेट पाएं',
        cancel: 'बुक किया शिपमेंट रद्द करें',
        ndr: 'NDR सूची से (नए फ़ोन या पते के साथ) दोबारा डिलीवरी करवाएं या वापस भेजें',
        reverse_pickup: 'ग्राहक के रिटर्न के लिए कूरियर पिकअप बुक करें',
      },
      notYetSupported: 'Ekart के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'यहाँ से लेबल छापना (Ekart लेबल फ़ाइल के रूप में भेजता है; अभी Ekart डैशबोर्ड से छापें)',
        'बुकिंग पर कूरियर सेवा चुनना (Ekart हर पार्सल का रास्ता खुद तय करता है)',
        'वॉलेट बैलेंस',
      ],
      webhookUrlLabel: 'ट्रैकिंग वेबहुक URL',
      webhookWhere: 'अपने Ekart अकाउंट मैनेजर को भेजें, या Ekart के वेबहुक API से दर्ज करें',
      webhookUrlHelp:
        'Ekart आपके लिए वेबहुक दर्ज करता है। उन्हें Connect पेज वाले उसी सीक्रेट के साथ यह पता दें और track_updated टॉपिक माँगें, ताकि स्कैन कुछ ही मिनट में इस ऐप तक पहुँचें।',
      copied: 'कॉपी हो गया',
    },
  }),
]
