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
    },
  }),
]
