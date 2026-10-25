import { connectAsideContent } from '@/data/connect-aside'
import { translation } from '@/lib/i18n'

export default [
  translation(connectAsideContent, {
    connection: 'कनेक्शन',
    connected: 'जुड़ा है',
    notConnected: 'जुड़ा नहीं',
    mode: 'मोड',
    test: 'टेस्ट',
    live: 'लाइव',
    originPin: 'भेजने का PIN',
    pickup: 'पिकअप लोकेशन',
    lastChecked: 'आखिरी जाँच',
    notChecked: 'अभी जाँच नहीं हुई',
    testAgain: 'फिर जाँचें',
    testing: 'जाँच हो रही है…',
    connectsTitle: 'इससे क्या जुड़ता है',
    guide: 'सेटअप गाइड देखें',
    pinInvalid: '6 अंकों का PIN कोड डालें।',
    providers: {
      delhivery: {
        connects: [
          'चेकआउट पर PIN से डिलीवरी की जाँच',
          'पिकअप बुक करें और लेबल छापें',
          'हर ऑर्डर की लाइव ट्रैकिंग',
          'डिलीवरी न हो पाने (NDR) पर आगे की कार्रवाई',
        ],
        helpTitle: 'मेरा API टोकन कहाँ है?',
        helpBody:
          'Delhivery One में Settings, फिर API Setup खोलें। अगर यह न दिखे तो अपने Delhivery मैनेजर से API एक्सेस चालू करवाएं।',
      },
      shiprocket: {
        connects: [
          'Shiprocket के हर पार्टनर के कूरियर रेट',
          'शिपमेंट बुक करें और लेबल छापें',
          'ट्रैकिंग और डिलीवरी न हो पाने (NDR) पर कार्रवाई',
          'आपके Shiprocket वॉलेट का बैलेंस',
        ],
        helpTitle: 'API यूज़र कहाँ से मिलेगा?',
        helpBody:
          'Shiprocket में Settings › API › Configure खोलें और एक API यूज़र जोड़ें। यहाँ उसका ईमेल और पासवर्ड डालें, अपना लॉगिन कभी नहीं।',
      },
      rapidshyp: {
        connects: [
          'RapidShyp नेटवर्क के कूरियर रेट',
          'शिपमेंट बुक करें और लेबल छापें',
          'पिकअप से पहले बुकिंग रद्द करें',
        ],
        helpTitle: 'मेरी API कुंजी कहाँ है?',
        helpBody: 'अपने RapidShyp डैशबोर्ड में Settings › API खोलें और वहाँ दिखी कुंजी कॉपी करें।',
      },
      bluedart: {
        connects: [
          'चेकआउट पर PIN से डिलीवरी और तारीख की जाँच',
          'लेबल PDF के साथ वेबिल बुक करें',
          'हर बुकिंग के साथ पिकअप दर्ज',
          'हर ऑर्डर की ट्रैकिंग',
        ],
        helpTitle: 'मेरी Blue Dart कुंजियाँ कहाँ हैं?',
        helpBody:
          'Client ID और secret के लिए DHL डेवलपर पोर्टल (developer.dhl.com, My Apps) पर Blue Dart APIs का ऐप बनाएं। Login ID, licence key, customer code और area code आपके Blue Dart अकाउंट मैनेजर से मिलते हैं।',
      },
      dtdc: {
        connects: [
          'चेकआउट पर PIN से डिलीवरी की जाँच',
          'कंसाइनमेंट बुक करें और लेबल छापें',
          'हर ऑर्डर की ट्रैकिंग',
          'पिकअप से पहले बुकिंग रद्द करें',
        ],
        helpTitle: 'मेरी DTDC API कुंजी कहाँ है?',
        helpBody:
          'API एक्सेस चालू होने पर DTDC आपको API key, customer code और ट्रैकिंग का यूज़रनेम-पासवर्ड भेजता है। न मिला हो तो अपने अकाउंट मैनेजर से पूछें।',
      },
      'india-post': {
        connects: [
          'भारत का हर पिनकोड, उसके डाकघर के साथ',
          'India Post के टैरिफ़ से Speed Post रेट',
          'बारकोड वाले पते के लेबल, लेबल पर COD',
          'हर ऑर्डर पर आपका दिया पार्सल स्टेटस',
        ],
        helpTitle: 'data.gov.in कुंजी कहाँ से मिलेगी?',
        helpBody:
          'data.gov.in पर मुफ़्त साइन अप करें, My Account खोलें और वहाँ दिखी API कुंजी कॉपी करें। यह ज़रूरी नहीं: इसके बिना भी रेट और डिलीवरी का समय चलता है।',
      },
      xpressbees: {
        connects: [
          'किसी रूट पर Xpressbees की हर सेवा के रेट',
          'अपने-आप पिकअप के साथ शिपमेंट बुक करें और लेबल छापें',
          'ट्रैकिंग और डिलीवरी न हो पाने (NDR) पर कार्रवाई',
        ],
        helpTitle: 'कौन सा लॉगिन इस्तेमाल करूँ?',
        helpBody:
          'वही ईमेल और पासवर्ड जिससे आप shipment.xpressbees.com में साइन इन करते हैं। API एक्सेस आपके Xpressbees अकाउंट मैनेजर चालू करते हैं।',
      },
      ekart: {
        connects: [
          'चेकआउट पर Ekart का दाम और डिलीवरी के दिन',
          'शिपमेंट और रिटर्न पिकअप बुक करें',
          'ट्रैकिंग और डिलीवरी न हो पाने (NDR) पर कार्रवाई',
        ],
        helpTitle: 'मेरे API क्रेडेंशियल कहाँ हैं?',
        helpBody:
          'ऑनबोर्डिंग पर Ekart एक क्लाइंट ID, API यूज़रनेम और पासवर्ड ईमेल करता है। न मिलें तो अपने Ekart अकाउंट मैनेजर से पूछें।',
      },
      shadowfax: {
        connects: [
          'चेकआउट पर PIN से डिलीवरी की जाँच',
          'शिपमेंट और रिटर्न पिकअप बुक करें, लेबल छापें',
          'ट्रैकिंग और डिलीवरी न हो पाने (NDR) पर कार्रवाई',
        ],
        helpTitle: 'मेरी API कुंजी कहाँ है?',
        helpBody:
          'अकाउंट चालू होने पर Shadowfax इसे ईमेल करता है। स्टेजिंग और प्रोडक्शन की कुंजियाँ अलग होती हैं; प्रोडक्शन वाली डालें।',
      },
      'dhl-express': {
        connects: [
          'ग्राहक के देश तक DHL Express के रेट, रुपये में',
          'कमर्शियल इनवॉइस के साथ लेबल, एक PDF में',
          'हर शिपमेंट के साथ DHL पिकअप',
          'हर एक्सपोर्ट की ट्रैकिंग',
        ],
        helpTitle: 'मेरी API key और secret कहाँ हैं?',
        helpBody:
          'developer.dhl.com पर My apps खोलें, "DHL Express - MyDHL API" वाला ऐप चुनें और उसकी key और secret कॉपी करें। अकाउंट नंबर आपके DHL इनवॉइस पर है।',
      },
      fedex: {
        connects: [
          'ग्राहक के देश तक FedEx के रेट, रुपये में',
          'कमर्शियल इनवॉइस के साथ लेबल, एक PDF में',
          'हर बुकिंग के बाद FedEx पिकअप',
          'ट्रैकिंग और रद्द करना',
        ],
        helpTitle: 'मेरी API key और secret key कहाँ हैं?',
        helpBody:
          'developer.fedex.com पर My Projects खोलें, अपना प्रोजेक्ट चुनें और टेस्ट या प्रोडक्शन की कुंजियाँ कॉपी करें। अकाउंट नंबर आपके FedEx इनवॉइस पर है।',
      },
    },
  }),
]
