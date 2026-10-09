import { loginContent } from '@/data/login'
import { translation } from '@/lib/i18n'

export default [
  translation(loginContent, {
    signIn: {
      title: 'वापसी पर स्वागत है',
      body: 'अपने ईमेल से साइन इन करें। हम आपको 6 अंकों का कोड भेजेंगे।',
      submit: 'कोड भेजें',
    },
    signUp: {
      title: 'अपना स्टोर बनाएं',
      body: (brand) => `${brand} के साथ शुरू करने के लिए अपना ईमेल डालें। हम आपको 6 अंकों का कोड भेजेंगे।`,
      submit: 'कोड भेजें',
      haveAccount: 'पहले से स्टोर है?',
      signInLink: 'साइन इन करें',
    },
    newHere: (brand) => `${brand} पर नए हैं?`,
    createStore: 'अपना स्टोर बनाएं',
    email: 'ईमेल',
    emailPlaceholder: 'you@yourstore.in',
    sending: 'कोड भेज रहे हैं',
    otp: {
      title: 'अपना ईमेल देखें',
      sentTo: (email) => `हमने ${email} पर 6 अंकों का कोड भेजा है।`,
      label: 'लॉगिन कोड',
      submit: 'लॉग इन करें',
      verifying: 'कोड जांच रहे हैं',
      resendIn: (time) => `${time} में दोबारा भेजें`,
      resend: 'नया कोड भेजें',
      resent: 'नया कोड भेज दिया गया है।',
      differentEmail: 'दूसरा ईमेल इस्तेमाल करें',
      devHint: 'डेवलपमेंट में कोड एडमिन सर्वर लॉग में छपता है।',
    },
    sendFailed: 'कोड नहीं भेज सके',
    wrongCode: 'कोड गलत है',
    terms: {
      prefix: 'आगे बढ़कर आप',
      terms: 'सेवा की शर्तें',
      and: 'और',
      privacy: 'गोपनीयता नीति',
    },
    panel: {
      label: 'आप क्या कर सकते हैं',
      dot: (n) => `स्लाइड ${n} दिखाएं`,
      slides: [
        { title: 'हर ऑर्डर, आते ही', body: 'नए ऑर्डर, बिक्री और शिपिंग एक नज़र में देखें।' },
        { title: 'अपने स्टोर से कुछ भी पूछें', body: 'बिक्री और स्टॉक के जवाब सीधी भाषा में पाएं।' },
        {
          title: 'GST इनवॉइस और WhatsApp अपडेट, अपने आप',
          body: 'हर ऑर्डर का इनवॉइस और ग्राहक को अपडेट अपने आप जाता है।',
        },
        { title: 'एक टैप में शिप करें', body: 'कूरियर चुनें, लेबल छापें, बस।' },
      ],
      order: { title: 'नया ऑर्डर #1043', meta: '₹4,499 · पुणे', paid: 'भुगतान हुआ' },
      sales: { label: 'आज की बिक्री', value: '₹84,200', change: '12%' },
      shipped: { title: 'Delhivery से भेजा गया', meta: 'AWB 3891 2045 7731' },
      ai: {
        question: 'इस हफ़्ते सबसे ज़्यादा कौन सा प्रोडक्ट बिका?',
        answer: 'कॉटन कुर्ता सेट, 42 बिके। पिछले हफ़्ते से 18% ज़्यादा।',
        bars: ['कॉटन कुर्ता', 'लिनन शर्ट', 'सिल्क दुपट्टा'],
      },
      invoice: { title: 'इनवॉइस INV-1043', gst: 'GST 5%', total: '₹4,499', status: 'भेजा गया' },
      whatsapp: 'नमस्ते आशा, आपका ऑर्डर #1043 पक्का हो गया है। हम इसे कल भेजेंगे।',
      couriers: [
        { name: 'Delhivery', eta: '2 दिन में डिलीवरी', price: '₹62' },
        { name: 'Shiprocket', eta: '3 दिन में डिलीवरी', price: '₹54' },
      ],
      labelPrinted: 'लेबल छप गया',
      built: 'भारतीय ब्रांड्स के लिए बना',
      chips: ['UPI', 'GST इनवॉइस', 'WhatsApp अपडेट'],
    },
  }),
]
