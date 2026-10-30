import { settingsRowsContent } from '@/data/settings-rows'
import { translation } from '@/lib/i18n'

export default [
  translation(settingsRowsContent, {
    needsFix: 'ठीक करना है',
    notSet: 'सेट नहीं',
    on: 'चालू',
    off: 'बंद',

    taxes: {
      back: 'GST और इनवॉइस',
      gstNumbers: 'GST नंबर',
      gstCount: (n) => (n === 0 ? 'कोई नहीं जोड़ा' : `${n} नंबर`),
      registration: 'GST रजिस्ट्रेशन',
      notRegistered: 'रजिस्टर्ड नहीं',
      charging: 'आप GST कैसे लेते हैं',
      composition: 'कंपोज़िशन स्कीम',
      rate: (rate, inclusive) => `${rate}% · ${inclusive ? 'कीमतों में GST शामिल' : 'ऊपर से जुड़ता है'}`,
      invoices: 'इनवॉइस नंबर',
      invoiceNext: (sample) => `अगला: ${sample}`,
      einvoice: 'ई-इनवॉइस (IRN)',
      einvoiceValue: 'जल्द आ रहा है',
    },

    notifications: {
      back: 'नोटिफ़िकेशन',
      customers: 'ग्राहकों के मैसेज',
      you: 'आपके लिए मैसेज',
      countOn: (on, total) => `${total} में से ${on} चालू`,
      sender: 'भेजने वाला ईमेल',
      senderValue: 'आपके ईमेल किसके नाम से जाते हैं',
      sending: 'मैसेज कैसे भेजे जाते हैं',
      email: 'ईमेल',
      whatsapp: 'WhatsApp',
      notConnected: 'कनेक्ट नहीं',
      advanced: 'एडवांस्ड',
      advancedValue: 'डेवलपर लॉग और ईमेल डिज़ाइन',
    },

    policies: {
      back: 'पॉलिसी',
      list: 'आपकी पॉलिसी',
      published: (n, total) => `${total} में से ${n} पब्लिश`,
      business: 'पॉलिसी पर बिज़नेस का नाम',
      grievance: 'ग्रीवेंस ऑफ़िसर',
    },

    returns: {
      back: 'रिटर्न',
      requests: 'ऑनलाइन रिटर्न रिक्वेस्ट',
      window: (days) => `चालू · डिलीवरी के ${days} दिन तक`,
      reasons: 'रिटर्न की वजहें',
      reasonsValue: (n, total) => `${total} में से ${n}`,
      rules: 'एक्सचेंज और अपने-आप मंज़ूरी',
      exchanges: 'एक्सचेंज',
      autoApprove: 'अपने-आप मंज़ूरी',
      refund: 'रिफ़ंड का सुझाव',
      original: 'जैसे पेमेंट किया',
      storeCredit: 'स्टोर क्रेडिट',
    },

    privacy: {
      back: 'प्राइवेसी और डेटा रिक्वेस्ट',
      banner: 'कुकी बैनर',
      bannerValue: (version, total) => `वर्ज़न ${version} · 30 दिन में ${total} जवाब`,
      requests: 'डेटा रिक्वेस्ट',
      requestsValue: (open, overdue) =>
        open === 0 ? 'कोई खुली नहीं' : overdue > 0 ? `${open} खुली, ${overdue} देर से` : `${open} खुली`,
      grievance: 'ग्रीवेंस ऑफ़िसर',
      accounts: 'ग्राहक अकाउंट',
      accountsValue: 'अकाउंट डिलीट करना',
    },

    staff: {
      members: 'मेंबर',
      membersValue: (n) => `${n} लोग`,
      invites: 'बाकी इनवाइट',
      invitesValue: (n) => (n === 0 ? 'कोई नहीं' : `${n} बाकी`),
      roles: 'रोल',
      rolesValue: (n) => `${n} रोल`,
    },

    ai: {
      usage: 'इस महीने का इस्तेमाल',
      features: 'AI फ़ीचर',
      featuresValue: (on, total, quality) => `${total} में से ${on} चालू · ${quality}`,
      privacy: 'AI क्या देखता है',
      privacyValue: 'आपका डेटा आपका ही रहता है',
      activity: 'AI की गतिविधि',
      activityValue: 'हर बदलाव, Undo के साथ',
    },

    costs: {
      ratesSet: (n, total) => `${total} में से ${n} भरे`,
      noGateways: 'अभी कोई गेटवे नहीं',
    },

    mcp: {
      connect: 'ऐप कनेक्ट करें',
      connectValue: 'पता और तरीका',
      apps: 'कनेक्टेड ऐप',
      appsValue: (n) => (n === 0 ? 'अभी कोई नहीं' : `${n} कनेक्टेड`),
      permissions: 'अनुमतियाँ',
      permissionsValue: (changes, customers) =>
        `${changes ? 'बदलाव कर सकते हैं' : 'सिर्फ़ देख सकते हैं'}${customers ? ' · ग्राहक दिखते हैं' : ''}`,
      tokens: 'API टोकन',
      tokensValue: (n) => (n === 0 ? 'कोई नहीं' : `${n} चालू`),
      activity: 'गतिविधि',
      activityValue: 'ऐप की हर रिक्वेस्ट',
    },

    billing: {
      autopayOn: 'UPI AutoPay चालू',
      payByLink: 'लिंक से पेमेंट',
      count: (n) => (n === 0 ? 'अभी कोई नहीं' : String(n)),
      downgradeTo: (plan) => `${plan} पर जाएँ`,
    },

    shipping: {
      back: 'शिपिंग और डिलीवरी',
      rates: 'शिपिंग रेट',
      ratesValue: 'ज़ोन, प्रोफ़ाइल और रेट',
      packages: 'पैकेज',
      packagesValue: (n) => (n === 0 ? 'कोई सेव नहीं' : `${n} पैकेज`),
      dispatch: 'डिस्पैच',
      dispatchValue: (pincode, cutoff) => `${pincode} से · ${cutoff} तक के ऑर्डर`,
      split: 'अलग-अलग पार्सल',
      splitValue: (n) => (n === 1 ? 'कभी नहीं बाँटते' : `${n} पार्सल तक`),
      courier: 'कौन-सा कूरियर भेजे',
      cheapest: 'सबसे सस्ता',
      preferred: (courier) => `हमेशा ${courier}`,
      perZone: 'इलाके के हिसाब से',
      pincode: 'PIN कोड जाँचें',
      pincodeValue: 'डिलीवरी की तारीख़ और कूरियर',
      demo: 'डेमो कूरियर',
    },

    approvals: {
      waitingValue: (n) => (n === 0 ? 'कुछ बाकी नहीं' : `${n} बाकी`),
      mineValue: (n) => (n === 0 ? '30 दिन में कोई नहीं' : `30 दिन में ${n}`),
    },
  }),
]
