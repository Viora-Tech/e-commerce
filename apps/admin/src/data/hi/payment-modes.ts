import { type PaymentModeId, paymentModesContent } from '@/data/payment-modes'
import { translation } from '@/lib/i18n'

export default [
  translation(paymentModesContent, {
    testBar: {
      title: 'Test मोड — पेमेंट असली नहीं हैं',
      body: 'चेकआउट पर ग्राहकों को "Test mode" बैज दिखता है। अभी पेमेंट हुए ऑर्डर Test के रूप में मार्क होते हैं और आपकी रिपोर्ट व GST इनवॉइस में नहीं आते।',
      banner: 'Test मोड — पेमेंट असली नहीं हैं।',
      bannerLink: 'पेमेंट सेटिंग्स',
    },
    mode: {
      label: 'इस्तेमाल हो रही keys',
      test: 'Test',
      live: 'Live',
      missing: (mode: PaymentModeId) =>
        mode === 'live' ? 'पहले अपनी live keys जोड़ें।' : 'पहले अपनी test keys जोड़ें।',
      addKeys: (mode: PaymentModeId) => (mode === 'live' ? 'Live keys जोड़ें' : 'Test keys जोड़ें'),
      toLive: {
        title: 'असली पेमेंट लेना शुरू करें?',
        body: 'चेकआउट आपकी live keys पर चला जाएगा। ग्राहक असली पैसे देंगे। पहले हम पेमेंट कंपनी से आपकी live keys जांचते हैं।',
        confirm: 'Live करें',
      },
      toTest: {
        title: 'Test मोड पर जाएं?',
        body: 'चेकआउट आपकी test keys पर चला जाएगा। जब तक आप फिर Live नहीं करते, ग्राहक असली पैसे नहीं दे पाएंगे। आपकी live keys सेव रहती हैं।',
        confirm: 'Test पर जाएं',
      },
      switched: (mode: PaymentModeId) =>
        mode === 'live' ? 'Live. अब पेमेंट असली हैं।' : 'Test मोड चालू है।',
      failed: 'बदल नहीं पाए। फिर कोशिश करें।',
    },
    active: {
      label: 'चालू',
      on: 'चालू',
      off: 'बंद',
      offTitle: 'इस पेमेंट कंपनी को बंद करें?',
      offBody:
        'ग्राहकों को चेकआउट पर यह तुरंत दिखना बंद हो जाएगा। इसकी keys और सेटिंग्स सेव रहती हैं, आप कभी भी इसे फिर चालू कर सकते हैं।',
      onlyOnline:
        'ऑनलाइन पेमेंट लेने का यह आपका अकेला तरीका है। ग्राहकों को सिर्फ़ कैश ऑन डिलीवरी या बैंक ट्रांसफ़र दिखेगा, अगर वे चालू हैं।',
      confirmOff: 'बंद करें',
      turnedOff: 'बंद हो गया। अब यह चेकआउट पर नहीं है।',
      turnedOn: 'चालू हो गया। यह फिर से चेकआउट पर है।',
      failed: 'सेव नहीं हो पाया। फिर कोशिश करें।',
      deactivate: (name: string) => `${name} बंद करें`,
      activate: (name: string) => `${name} चालू करें`,
      inactiveHelp: 'बंद: ग्राहकों को यह चेकआउट पर नहीं दिखता। इसकी keys और सेटिंग्स सेव हैं।',
    },
    keySet: {
      editing: (mode: PaymentModeId) =>
        mode === 'live' ? 'आप अपनी live keys बदल रहे हैं।' : 'आप अपनी test keys बदल रहे हैं।',
      waiting: (mode: PaymentModeId) =>
        mode === 'live'
          ? 'सेव हो गया। चेकआउट अभी भी test keys पर है; तैयार हों तो पेमेंट पेज पर Live करें।'
          : 'सेव हो गया। चेकआउट अभी भी live keys पर है; आज़माने के लिए पेमेंट पेज पर Test करें।',
    },
    others: {
      heading: 'दूसरी पेमेंट कंपनियां',
    },
  }),
]
