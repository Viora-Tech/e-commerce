import { settingsContent, settingsHomeContent } from '@/data/settings'
import { translation } from '@/lib/i18n'

export default [
  translation(settingsContent, {
    nav: {
      label: 'Settings के हिस्से',
    },
    sections: {
      payments: [
        { id: 'section-methods', label: 'पेमेंट के तरीके' },
        { id: 'section-unpaid', label: 'बिना पेमेंट वाले ऑर्डर' },
        { id: 'section-preorders', label: 'प्री-ऑर्डर' },
      ],
      files: [
        { id: 'section-providers', label: 'स्टोरेज' },
        { id: 'section-verify', label: 'कनेक्शन' },
      ],
    },
    general: {
      title: 'सामान्य',
      intro: 'आपकी दुकान का नाम, ग्राहक आपसे कैसे संपर्क करें, और इनवॉइस के लिए आपका पता।',
      completion: {
        progress: (done, total) => `${total} में से ${done} जानकारी भरी गई`,
        allDone: 'आपकी दुकान की सारी जानकारी भर गई है।',
        missing: (items) => `अभी भरना बाकी: ${items.join(', ')}।`,
        items: {
          name: 'स्टोर का नाम',
          email: 'संपर्क ईमेल',
          phone: 'फ़ोन',
          address: 'बिज़नेस का पता',
          gstin: 'GSTIN',
        },
      },
      details: {
        heading: 'स्टोर की जानकारी',
        help: 'ग्राहक इन्हें ऑर्डर ईमेल और इनवॉइस पर देखते हैं।',
        name: 'स्टोर का नाम',
        nameHelp: 'वह नाम जिससे ग्राहक आपकी दुकान को जानते हैं।',
        email: 'संपर्क ईमेल',
        emailHelp: 'ऑर्डर ईमेल पर दिखता है। ग्राहक जवाब दें तो यहीं आता है।',
        phone: 'फ़ोन',
        phoneHelp: 'ग्राहक और कूरियर आपको कॉल कर सकें। देश का कोड भी लिखें, जैसे +91।',
      },
      address: {
        heading: 'बिज़नेस का पता',
        help: 'इनवॉइस पर छपता है और डिलीवरी की तारीख निकालने में काम आता है।',
        prompt: {
          title: 'अपने बिज़नेस का पता जोड़ें',
          body: 'यह आपके इनवॉइस पर छपता है और इससे पता चलता है कि पार्सल कब पहुंचेंगे।',
          action: 'पता जोड़ें',
        },
        line1: 'पता, लाइन 1',
        line2: 'पता, लाइन 2 (ज़रूरी नहीं)',
        city: 'शहर',
        state: 'राज्य',
        pincode: 'पिनकोड',
        country: 'देश',
      },
      tax: {
        heading: 'टैक्स / GST',
        help: 'सिर्फ़ तभी ज़रूरी है जब आपकी दुकान GST में रजिस्टर्ड है। नहीं है तो इसे छोड़ दें।',
        gstin: 'GSTIN',
        gstinHelp: 'आपका 15 अक्षर का GST नंबर। यह टैक्स इनवॉइस पर छपता है।',
        gstRate: 'आपकी कीमतों में GST (%)',
        gstRateHelp:
          'आपकी कीमतों में पहले से जुड़ा GST। ज़्यादातर दुकानें 18 रखती हैं। इनवॉइस पर CGST, SGST और IGST दिखाने में काम आता है।',
      },
      locale: {
        heading: 'करेंसी और समय',
        help: 'कीमतों, ऑर्डर के समय और रिपोर्ट में काम आता है।',
        currency: 'करेंसी',
        currencyHelp: 'अभी सिर्फ़ भारतीय रुपया (INR)।',
        timezone: 'टाइम ज़ोन',
      },
      timezones: [
        { value: 'Asia/Kolkata', label: 'भारत (Asia/Kolkata)' },
        { value: 'Asia/Dubai', label: 'खाड़ी (Asia/Dubai)' },
        { value: 'Asia/Singapore', label: 'सिंगापुर (Asia/Singapore)' },
        { value: 'Europe/London', label: 'लंदन (Europe/London)' },
        { value: 'America/New_York', label: 'न्यूयॉर्क (America/New_York)' },
      ],
      saved: 'स्टोर की जानकारी सेव हो गई',
      failed: 'स्टोर की जानकारी सेव नहीं हो पाई',
      unsaved: 'बदलाव सेव नहीं हुए',
      save: 'सेव करें',
      discard: 'रद्द करें',
    },
    staff: {
      heading: 'अभी सिर्फ़ आप',
      body: 'अपनी टीम को जोड़ें और तय करें कि हर व्यक्ति इस स्टोर में क्या देख और बदल सकता है।',
    },
  }),
  translation(settingsHomeContent, {
    title: 'Settings',
    intro: 'आपकी दुकान कैसे चलती है, सब कुछ एक जगह।',
    checklist: {
      heading: 'अपनी दुकान तैयार करें',
      help: 'ये एक बार करने हैं। हर काम पूरा होते ही अपने आप टिक हो जाता है।',
      progress: (done, total) => `${total} में से ${done} पूरे`,
      progressLabel: 'सेटअप कितना हुआ',
      allDone: 'सब हो गया। आपकी दुकान बेचने के लिए तैयार है।',
      doneLabel: 'पूरा',
      open: 'खोलें',
      loadFailed: 'आपकी चेकलिस्ट लोड नहीं हो पाई।',
      items: {
        store: {
          title: 'स्टोर की जानकारी',
          todo: 'अपनी दुकान का नाम, ईमेल और बिज़नेस का पता जोड़ें।',
          done: 'नाम, ईमेल और पता भर गए हैं।',
          href: '/settings/general',
        },
        payments: {
          title: 'पेमेंट',
          todo: 'चुनें कि ग्राहक आपको कैसे पेमेंट करें: UPI, कार्ड या कैश ऑन डिलीवरी (COD)।',
          done: 'आपने चुन लिया है कि ग्राहक कैसे पेमेंट करेंगे।',
          href: '/settings/payments',
        },
        shipping: {
          title: 'शिपिंग',
          todo: 'बताएं कि आप कहाँ डिलीवर करते हैं और डिलीवरी का कितना चार्ज है।',
          done: 'डिलीवरी के इलाके और चार्ज सेट हैं।',
          href: '/settings/shipping',
        },
        taxes: {
          title: 'टैक्स / GST',
          todo: 'GST में रजिस्टर्ड हैं तो अपना GSTIN जोड़ें। नहीं हैं तो इसे छोड़ दें।',
          done: 'आपका GSTIN आपके इनवॉइस पर है।',
          href: '/settings/general#tax',
        },
        domain: {
          title: 'डोमेन',
          todo: 'अपनी वेबसाइट का पता जोड़ें, जैसे yourshop.in।',
          done: 'आपकी अपनी वेबसाइट का पता चल रहा है।',
          href: '/settings/domains',
        },
        notifications: {
          title: 'नोटिफ़िकेशन',
          todo: 'ईमेल जोड़ें ताकि ऑर्डर करने पर ग्राहकों को आपकी तरफ़ से मैसेज मिले।',
          done: 'ग्राहकों को ऑर्डर ईमेल मिलते हैं।',
          href: '/settings/notifications',
        },
        policies: {
          title: 'पॉलिसी',
          todo: 'रिटर्न, प्राइवेसी और शर्तों वाले पेज पब्लिश करें।',
          done: 'आपके पॉलिसी पेज लाइव हैं।',
          href: '/online-store/pages',
        },
      },
    },
    all: {
      heading: 'सारी Settings',
    },
  }),
]
