import { xpressbeesAppContent } from '@/data/xpressbees'
import { translation } from '@/lib/i18n'

export default [
  translation(xpressbeesAppContent, {
    connect: {
      title: 'Xpressbees जोड़ें',
      intro: 'अपना Xpressbees अकाउंट जोड़ने के लिए नीचे के तीन चरण पूरे करें। लगभग एक मिनट लगता है।',
      dashboardUrl: 'https://shipment.xpressbees.com/',
      signupUrl: 'https://www.xpressbees.com/',
      openDashboard: 'Xpressbees खोलें',
      noAccount: 'Xpressbees अकाउंट नहीं है?',
      signUp: 'साइन अप करें',
      steps: {
        one: {
          title: 'API एक्सेस माँगें',
          body: 'shipment.xpressbees.com में साइन इन करें। API एक्सेस आपके Xpressbees अकाउंट मैनेजर चालू करते हैं; अगर आपने पहले API इस्तेमाल नहीं किया है तो उनसे कहें।',
        },
        two: {
          title: 'अपना लॉगिन और पिकअप वेयरहाउस नोट करें',
          body: 'हम उसी ईमेल और पासवर्ड से जुड़ते हैं जिससे आप साइन इन करते हैं। Warehouses में उस वेयरहाउस का सटीक नाम कॉपी करें जहाँ से पार्सल निकलते हैं।',
        },
        three: {
          title: 'इन्हें नीचे पेस्ट करें',
          body: 'फ़ील्ड भरें, फिर सेव करने से पहले "कनेक्शन जाँचें" से पक्का करें कि सब ठीक है।',
        },
      },
      stepDone: 'हो गया',
      stepLabel: (n: number) => `चरण ${n}`,
      fields: {
        email: {
          label: 'लॉगिन ईमेल',
          help: 'वह ईमेल जिससे आप shipment.xpressbees.com में साइन इन करते हैं।',
        },
        password: {
          label: 'पासवर्ड',
          help: 'आपका Xpressbees पासवर्ड। यह एन्क्रिप्ट करके रखा जाता है और फिर कभी नहीं दिखाया जाता।',
        },
        warehouseName: {
          label: 'पिकअप वेयरहाउस का नाम',
          help: 'Xpressbees डैशबोर्ड पर लिखे वेयरहाउस के नाम से हूबहू मिलना चाहिए।',
        },
        originPincode: {
          label: 'भेजने का PIN कोड',
          help: 'वह 6 अंकों का PIN कोड जहाँ से पार्सल भेजे जाते हैं। इससे हम कनेक्शन जाँचते हैं और रेट की तुलना करते हैं।',
        },
      },
      testConnection: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint:
        'हम साइन इन करके आपके अपने PIN कोड के रेट माँगकर यह जाँचते हैं। कुछ भी बुक नहीं होता। वेयरहाउस का नाम सिर्फ़ शिपमेंट बुक करते समय जाँचा जाता है।',
      advanced: {
        trigger: 'एडवांस्ड',
        baseUrlLabel: 'API बेस URL',
        baseUrlHelp: 'प्रोडक्शन के लिए खाली छोड़ें।',
        webhookSecretLabel: 'वेबहुक सीक्रेट',
        webhookSecretHelp:
          'अपने-आप ट्रैकिंग अपडेट के लिए ज़रूरी। Xpressbees वेबहुक पेज पर यही सीक्रेट डालें; जो कॉल इससे साइन न हो वह ठुकरा दी जाती है।',
        webhookUrlLabel: 'ट्रैकिंग वेबहुक URL',
        webhookNeedsDomain:
          'वेबहुक तभी काम करते हैं जब आपका स्टोर किसी पब्लिक डोमेन पर लाइव हो; कूरियर localhost या प्रीव्यू URL तक नहीं पहुँच सकता।',
      },
      rateLimited: 'बहुत ज़्यादा कोशिशें हुईं। कुछ मिनट रुककर फिर कोशिश करें।',
    },
    overview: {
      title: 'Xpressbees',
      subtitle: 'Surface, Air और उसी दिन डिलीवरी के रेट, अपने-आप पिकअप के साथ बुकिंग, ट्रैकिंग और NDR।',
      notConnected: 'अभी जुड़ा नहीं है। शिपमेंट बुक करने के लिए अपने अकाउंट की जानकारी डालें।',
      connectCta: 'अपना अकाउंट जोड़ें',
      connected: 'जुड़ा है',
      connectedAndTested: 'जुड़ा है ✓ जाँचा गया',
      goToShipments: 'शिपमेंट वर्कस्पेस खोलें',
      goToShipmentsHelp: 'Orders → Shipments से हर Xpressbees शिपमेंट बुक करें, ट्रैक करें और संभालें।',
      capabilitiesHeading: 'यह ऐप क्या कर सकता है',
      capabilities: {
        serviceability: 'देखें कि PIN कोड पर डिलीवरी होती है या नहीं, और COD मिलता है या नहीं',
        rates: 'Xpressbees की सेवाओं (Surface, Air, उसी दिन) के दाम की तुलना करें',
        create_shipment: 'शिपमेंट बुक करें और AWB पाएं; पिकअप अपने-आप माँगा जाता है',
        label: 'शिपिंग लेबल छापें',
        tracking: 'दिन में कुछ बार स्कैन अपने-आप ट्रैक करें',
        webhook: 'वेबहुक चालू करने पर लगभग तुरंत ट्रैकिंग अपडेट पाएं',
        cancel: 'पिकअप से पहले बुक किया शिपमेंट रद्द करें',
        ndr: 'NDR सूची से दोबारा डिलीवरी, पता या फ़ोन बदलें',
      },
      notYetSupported: 'Xpressbees के लिए अभी उपलब्ध नहीं',
      notYetSupportedItems: [
        'रिटर्न पिकअप (Xpressbees API पर अभी पक्का नहीं)',
        'वॉलेट बैलेंस',
        'चेकआउट पर डिलीवरी के दिन (Xpressbees ये नहीं भेजता; आपके अपने ट्रांज़िट दिन इस्तेमाल होते हैं)',
      ],
      webhookUrlLabel: 'ट्रैकिंग वेबहुक URL',
      webhookWhere: 'Xpressbees डैशबोर्ड → Settings → Webhook में पेस्ट करें',
      webhookUrlHelp:
        'इसे Connect पेज वाले उसी सीक्रेट के साथ Xpressbees वेबहुक सेटिंग में पेस्ट करें, ताकि स्कैन अगली जाँच का इंतज़ार किए बिना कुछ ही मिनट में इस ऐप तक पहुँचें।',
      copied: 'कॉपी हो गया',
    },
  }),
]
