import { chatwootContent } from '@/data/chatwoot'
import { translation } from '@/lib/i18n'

export default [
  translation(chatwootContent, {
    title: 'Chatwoot',
    subtitle: 'आपके स्टोर पर लाइव चैट, और शॉपर्स के हर मैसेज के लिए एक ही इनबॉक्स।',
    save: 'सेव करें',
    discard: 'छोड़ें',
    unsaved: 'बिना सेव किए बदलाव',
    saved: 'सेव हो गया',
    failed: 'सेव नहीं हो पाया। फिर से कोशिश करें।',
    open: 'Chatwoot खोलें',
    status: {
      live: 'आपके स्टोर पर चैट चालू है।',
      identifying: 'साइन-इन किए शॉपर्स पहचाने जाते हैं, और चैट के साथ उनके ऑर्डर दिखते हैं।',
      api: 'ग्राहक Chatwoot में कॉन्टैक्ट के रूप में रखे जाते हैं, और उनकी चैट ग्राहक और ऑर्डर पेज पर दिखती है।',
      notSetUp: 'अभी सेट नहीं हुआ। नीचे अपना Chatwoot पता और वेबसाइट इनबॉक्स जोड़ें।',
    },
    connect: {
      title: 'Chatwoot जोड़ें',
      description:
        'Chatwoot एक ओपन-सोर्स सपोर्ट इनबॉक्स है: वेबसाइट चैट, WhatsApp, ईमेल और बहुत कुछ एक ही जगह। Chatwoot Cloud या अपना Chatwoot सर्वर इस्तेमाल करें।',
      baseUrl: {
        label: 'Chatwoot पता',
        help: 'जहाँ आपका Chatwoot खुलता है, जैसे https://support.yourstore.in. Chatwoot Cloud इस्तेमाल कर रहे हैं? app.chatwoot.com लिखें।',
        placeholder: 'https://app.chatwoot.com',
      },
      accountId: {
        label: 'अकाउंट id',
        help: 'आपके Chatwoot के पते में /app/accounts/ के बाद वाला नंबर। ऊपर पूरा डैशबोर्ड लिंक पेस्ट करने पर यह अपने आप भर जाता है।',
        placeholder: '1',
      },
      websiteToken: {
        label: 'वेबसाइट इनबॉक्स टोकन',
        help: 'Chatwoot में: Settings → Inboxes → आपका वेबसाइट इनबॉक्स → Configuration. स्क्रिप्ट से websiteToken कॉपी करें। अभी वेबसाइट इनबॉक्स नहीं है? पहले वहाँ एक बनाएँ।',
        placeholder: 'वेबसाइट टोकन पेस्ट करें',
      },
      apiToken: {
        label: 'API access token',
        help: 'इससे कॉन्टैक्ट सिंक रहते हैं और बातचीत यहाँ दिखती है। Chatwoot में: आपकी प्रोफ़ाइल → Profile settings → Access token.',
        placeholder: 'टोकन पेस्ट करें',
        saved: 'एक टोकन सेव है। बदलने के लिए नया पेस्ट करें।',
        remove: 'टोकन हटाएँ',
        removed: 'टोकन हटा दिया गया',
      },
      hmacToken: {
        label: 'पहचान सीक्रेट (HMAC)',
        help: 'इससे पक्का होता है कि साइन-इन किया शॉपर वही है जो वह कहता है। Chatwoot में: आपका वेबसाइट इनबॉक्स → Configuration → Identity validation. वहाँ “Enforce user identity validation” भी चालू करें।',
        placeholder: 'सीक्रेट पेस्ट करें',
        saved: 'एक सीक्रेट सेव है। बदलने के लिए नया पेस्ट करें।',
        remove: 'सीक्रेट हटाएँ',
        removed: 'सीक्रेट हटा दिया गया',
      },
      check: {
        label: 'कनेक्शन जाँचें',
        help: 'जाँचता है कि टोकन से अकाउंट खुलता है और वेबसाइट टोकन उसी अकाउंट का है। Chatwoot में कुछ नहीं बनाता।',
      },
      test: 'कनेक्शन जाँचें',
      testOk: (agent: string, inbox: string | null) =>
        inbox ? `${agent} के रूप में जुड़ गया। वेबसाइट इनबॉक्स: ${inbox}` : `${agent} के रूप में जुड़ गया`,
      testNeeds: 'पहले पता, अकाउंट id और API access token जोड़ें।',
    },
    shoppers: {
      title: 'शॉपर्स',
      identify: {
        label: 'साइन-इन किए शॉपर्स को पहचानें',
        help: 'चैट के साथ उनका नाम, ईमेल, फ़ोन, कब से ग्राहक हैं, ऑर्डर, कुल खर्च और आख़िरी ऑर्डर दिखता है। इसके लिए पहचान सीक्रेट चाहिए।',
      },
      sync: {
        label: 'ग्राहकों को Chatwoot कॉन्टैक्ट के रूप में रखें',
        help: 'जब कोई ग्राहक साइन अप करता है, अपनी जानकारी बदलता है या भुगतान करता है, तो Chatwoot में उसका कॉन्टैक्ट बनता या अपडेट होता है। इसके लिए API access token चाहिए।',
      },
    },
    privacy: {
      title: 'प्राइवेसी',
      label: 'चैट कब लोड हो',
      help: 'Chatwoot एक कुकी रखता है ताकि शॉपर की चैट हर पेज पर जारी रहे। चुनें कि यह कब लोड हो।',
      options: {
        necessary: 'हमेशा (शॉपर्स ख़ुद चैट माँगते हैं)',
        analytics: 'जब शॉपर analytics कुकी की अनुमति दे',
        marketing: 'जब शॉपर marketing कुकी की अनुमति दे',
      },
    },
    credit: 'Chatwoot ओपन सोर्स है (MIT लाइसेंस), Chatwoot Inc. ने बनाया है।',
    card: {
      title: 'बातचीत',
      open: 'Chatwoot में खोलें',
      contact: 'Chatwoot में कॉन्टैक्ट',
      empty: 'इस ग्राहक से अभी कोई बातचीत नहीं हुई।',
      noContact: 'इस ग्राहक ने अभी तक आपसे चैट नहीं की है।',
      notConnected: 'यहाँ बातचीत देखने के लिए Chatwoot ऐप में API access token जोड़ें।',
      settings: 'Chatwoot सेटिंग्स',
      error: 'बातचीत लोड नहीं हो पाई।',
      unread: (n: number) => `${n} अनपढ़े`,
      noPreview: 'अभी कोई मैसेज नहीं',
      statuses: {
        open: 'खुली',
        pending: 'बाक़ी',
        snoozed: 'स्नूज़',
        resolved: 'हल हो गई',
      },
    },
  }),
]
