import { profitCostsContent } from '@/data/profit-costs'
import { translation } from '@/lib/i18n'

export default [
  translation(profitCostsContent, {
    title: 'मुनाफ़े के लिए खर्च',
    intro:
      'ऑर्डर के मुनाफ़े से हर पेमेंट का खर्च घटता है। असली फ़ीस हर पेमेंट के लिए Razorpay या Cashfree से आती है; ये दरें सिर्फ़ तब तक लगती हैं जब तक फ़ीस नहीं आती।',
    methods: {
      heading: 'ग्राहक ने कैसे पेमेंट किया, उसके हिसाब से फ़ीस',
      help: 'Razorpay की स्टैंडर्ड दरें भरी हैं। ये स्टैंडर्ड दरें हैं: अपना प्लान देखें, आपकी दरें कम हो सकती हैं। हर दर GST से पहले की लिखें।',
      reset: 'स्टैंडर्ड दरें लगाएँ',
      names: {
        upi: 'UPI',
        rupay_debit: 'RuPay डेबिट कार्ड',
        debit_card: 'बाकी डेबिट कार्ड',
        credit_card: 'क्रेडिट कार्ड',
        international_card: 'विदेशी कार्ड',
        corporate_card: 'कॉरपोरेट, Amex और Diners कार्ड',
        netbanking: 'नेट बैंकिंग',
        wallet: 'वॉलेट',
        emi: 'EMI',
        pay_later: 'पे लेटर',
      },
    },
    gst: {
      claimable: 'आपका GST रजिस्ट्रेशन है, इसलिए इन फ़ीस पर लगा GST आप वापस लेते हैं और मुनाफ़े में वह नहीं घटता।',
      notClaimable: 'मुनाफ़े में हर दर पर 18% GST जोड़ा जाता है, जैसे गेटवे और कूरियर लेते हैं।',
    },
    gateways: {
      heading: 'गेटवे के हिसाब से फ़ीस',
      help: 'तब लगती है जब गेटवे नहीं बताता कि ग्राहक ने कैसे पेमेंट किया, और Decentro जैसे गेटवे के लिए। हर दर GST से पहले की लिखें।',
      none: 'अभी कोई ऑनलाइन पेमेंट तरीका चालू नहीं है। Settings › Payments में चालू करें।',
    },
    cod: {
      heading: 'कैश ऑन डिलीवरी',
      help: 'ग्राहक से कैश लेने के लिए आपका कूरियर कितना रखता है, GST से पहले।',
      label: 'कैश ऑन डिलीवरी',
    },
    percent: 'प्रतिशत (%)',
    fixed: 'तय रकम (₹)',
    methodNames: profitCostsContent.methodNames,
    save: 'सेव करें',
    saved: 'सेव हो गया',
    failed: 'सेव नहीं हो सका',
    invalid: (method) => `${method} की रकम जाँचें: 100 तक प्रतिशत और रुपये में रकम।`,
  }),
]
