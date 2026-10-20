import { shadowfaxAppContent } from '@/data/shadowfax'
import { translation } from '@/lib/i18n'

export default [
  translation(shadowfaxAppContent, {
    connect: {
      title: 'Shadowfax जोड़ें',
      intro: 'अपना Shadowfax अकाउंट जोड़ने के लिए नीचे के तीन चरण पूरे करें। लगभग एक मिनट लगता है।',
      dashboardUrl: 'https://www.shadowfax.in/',
      signupUrl: 'https://www.shadowfax.in/',
      openDashboard: 'Shadowfax खोलें',
      noAccount: 'Shadowfax अकाउंट नहीं है?',
      signUp: 'साइन अप करें',
      steps: {
        one: {
          title: 'अपनी API कुंजी ढूँढें',
          body: 'अकाउंट चालू होने पर Shadowfax आपकी API कुंजी ईमेल करता है। स्टेजिंग और प्रोडक्शन की कुंजियाँ अलग होती हैं; यहाँ प्रोडक्शन वाली डालें।',
        },
        two: {
          title: 'इसे सुरक्षित रखें',
          body: 'इसी कुंजी से आपके अकाउंट पर बुकिंग हो सकती है, इसलिए इसे पासवर्ड मैनेजर में रखें और चैट में कभी शेयर न करें।',
        },
        three: {
          title: 'इसे नीचे पेस्ट करें',
          body: 'फ़ील्ड भरें, फिर सेव करने से पहले "कनेक्शन जाँचें" से पक्का करें कि सब ठीक है।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n: number) => `चरण ${n}`,
      fields: {
        apiToken: {
          label: 'API कुंजी',
          help: 'उस ईमेल से जो अकाउंट चालू होने पर Shadowfax भेजता है।',
        },
        originPincode: {
          label: 'भेजने का PIN कोड',
          help: 'वह 6 अंकों का PIN कोड जहाँ से पार्सल भेजे जाते हैं। Shadowfax हर ऑर्डर की भेजने वाली लोकेशन के पते से पार्सल उठाता है।',
        },
        sellerGstin: {
          label: 'विक्रेता का GSTIN',
          help: 'रिटर्न पिकअप पर इस्तेमाल होता है। GST में रजिस्टर्ड नहीं हैं तो खाली छोड़ें।',
        },
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint: 'हम आपके अपने PIN कोड पर डिलीवरी की जाँच करके यह देखते हैं। कुछ भी बुक नहीं होता।',
      advanced: {
        trigger: 'एडवांस्ड',
        baseUrlLabel: 'API बेस URL',
        baseUrlHelp:
          'प्रोडक्शन के लिए खाली छोड़ें। स्टेजिंग कुंजी के लिए https://dale.staging.shadowfax.in/api डालें',
        webhookSecretLabel: 'वेबहुक कुंजी',
        webhookSecretHelp:
          'अपने-आप ट्रैकिंग अपडेट के लिए ज़रूरी। Shadowfax क्लाइंट पोर्टल के Webhook टैब पर Authorization वाली कुंजी यहाँ भी डालें; इसके बिना आया पुश ठुकरा दिया जाता है।',
        webhookUrlLabel: 'ट्रैकिंग वेबहुक URL',
        webhookNeedsDomain:
          'वेबहुक तभी काम करते हैं जब आपका स्टोर किसी पब्लिक डोमेन पर लाइव हो; कूरियर localhost या प्रीव्यू URL तक नहीं पहुँच सकता।',
      },
      rateLimited: 'बहुत ज़्यादा कोशिशें हुईं। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'Shadowfax',
      subtitle: 'Shadowfax नेटवर्क पर भेजने और रिटर्न की बुकिंग, लेबल, ट्रैकिंग और NDR।',
      notConnected: 'अभी जुड़ा नहीं है। शिपमेंट बुक करने के लिए अपने अकाउंट की जानकारी डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा है',
      connectedAndTested: 'जुड़ा है ✓ जाँचा गया',
      goToShipments: 'शिपमेंट वर्कस्पेस खोलें',
      goToShipmentsHelp: 'Orders → Shipments से हर Shadowfax शिपमेंट बुक करें, ट्रैक करें और संभालें।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'देखें कि PIN कोड पर डिलीवरी होती है या नहीं',
        create_shipment: 'शिपमेंट बुक करें और AWB पाएं; पिकअप Shadowfax तय करता है',
        label: 'शिपिंग लेबल छापें (पार्सल उठने तक)',
        tracking: 'दिन में कुछ बार स्कैन अपने-आप ट्रैक करें',
        webhook: 'वेबहुक चालू करने पर लगभग तुरंत ट्रैकिंग अपडेट पाएं',
        cancel: 'शिपमेंट रद्द करें, चल रहा हो तब भी (Shadowfax उसे अगले हब पर रोक देता है)',
        ndr: 'NDR सूची से दोबारा डिलीवरी, पता बदलें या वापस भेजें',
        reverse_pickup: 'ग्राहक के रिटर्न के लिए कूरियर पिकअप बुक करें',
      },
      notYetSupported: 'Shadowfax के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'रेट और डिलीवरी के दिन (Shadowfax के पास दाम देखने का API नहीं; चेकआउट आपके अपने शिपिंग रेट इस्तेमाल करता है)',
        'वॉलेट बैलेंस',
      ],
      webhookUrlLabel: 'ट्रैकिंग वेबहुक URL',
      webhookWhere: 'Shadowfax क्लाइंट पोर्टल → Webhook में पेस्ट करें',
      webhookUrlHelp:
        'इसे Shadowfax क्लाइंट पोर्टल के Webhook टैब में Authorization हेडर वाली उसी कुंजी के साथ पेस्ट करें, ताकि स्कैन अगली जाँच का इंतज़ार किए बिना कुछ ही मिनट में इस ऐप तक पहुँचें।',
      copied: 'कॉपी हो गया',
    },
  }),
]
