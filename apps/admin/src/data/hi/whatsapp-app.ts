import { siteConfig } from '@commerce/config/site'
import { whatsappAppContent } from '@/data/whatsapp-app'
import { translation } from '@/lib/i18n'

export default [
  translation(whatsappAppContent, {
    connectAction: 'WhatsApp जोड़ें',
    setup: {
      title: 'WhatsApp सेटअप पूरा करें',
      intro: 'तीन कदम, लगभग 10 मिनट। पूरा होते ही ऑर्डर अपडेट WhatsApp पर जाने लगेंगे।',
      doneTitle: 'WhatsApp सेट हो गया',
      doneIntro: 'ऑर्डर अपडेट WhatsApp पर जा रहे हैं। उन्हें Messages में देखें।',
      card: 'सेटअप',
      progress: (done: number, total: number) => `${total} में से ${done} पूरे`,
      number: {
        title: 'अपना WhatsApp Business नंबर जोड़ें',
        verified: (n: string) => `${n} · वेरिफ़ाइड`,
        saved: (n: string) => `${n} · सेव है`,
        savedNoName: 'नंबर सेव है',
        todo: 'वह नंबर जिससे ग्राहकों को मैसेज जाते हैं',
        action: 'नंबर जोड़ें',
      },
      meta: {
        title: 'अपना Meta बिज़नेस अकाउंट जोड़ें',
        todo: `इससे ${siteConfig.brand.name} आपके नंबर से मैसेज भेज पाता है`,
        done: 'जुड़ गया · मैसेज आपके नंबर से जाते हैं',
        testMode: 'टेस्ट मोड में जुड़ा · सादा टेक्स्ट, सिर्फ़ उन्हें जिन्होंने आज आपको मैसेज किया',
        action: 'जोड़ें',
      },
      templates: {
        title: 'मैसेज टेम्पलेट मंज़ूर कराएं',
        todo: 'ऑर्डर कन्फ़र्म, शिप और डिलीवर · Meta लगभग एक घंटे में जांचता है',
        pending: 'Meta को भेजे गए · जांच बाकी है, आम तौर पर लगभग एक घंटा',
        rejected: 'Meta ने एक टेम्पलेट नामंज़ूर किया · वजह Templates में देखें',
        done: 'ऑर्डर कन्फ़र्म, शिप और डिलीवर के टेम्पलेट मंज़ूर हैं',
        unknown: 'Settings में WhatsApp Business Account ID डालें ताकि हम इन्हें जांच सकें',
        action: 'टेम्पलेट भेजें',
        manual: 'टेम्पलेट खोलें',
        submitting: 'भेज रहे हैं…',
      },
      stepDone: 'पूरा',
      stepTodo: 'अभी बाकी',
      previewTitle: 'ग्राहकों को क्या मिलता है',
      previewHelp: 'आपके ऑर्डर कन्फ़र्म और शिप वाले मैसेज, नमूना जानकारी के साथ।',
    },
    submit: {
      sent: (n: number) =>
        n === 1 ? 'टेम्पलेट जांच के लिए Meta को भेजा' : `${n} टेम्पलेट जांच के लिए Meta को भेजे`,
      failed: (name: string, reason: string) => `${name}: ${reason}`,
      error: 'टेम्पलेट नहीं भेजे जा सके। फिर कोशिश करें।',
    },
    templates: {
      title: 'मैसेज टेम्पलेट',
      intro:
        'WhatsApp ऑर्डर अपडेट सिर्फ़ Meta के मंज़ूर किए टेम्पलेट से भेजता है। नीचे हर मैसेज के लिए ठीक इसी नाम और बॉडी वाला Utility टेम्पलेट चाहिए।',
      live: 'स्टेटस आपके WhatsApp Business अकाउंट से आते हैं।',
      noWaba:
        'हर टेम्पलेट का स्टेटस देखने और यहीं से भेजने के लिए Settings में WhatsApp Business Account ID डालें। तब तक हर एक को WhatsApp Manager → Message templates में कॉपी करें।',
      noConnection:
        'हर टेम्पलेट का स्टेटस देखने के लिए WhatsApp जोड़ें। हर एक को अभी भी WhatsApp Manager → Message templates में कॉपी कर सकते हैं।',
      metaError: (message: string) => `Meta ने जवाब नहीं दिया: ${message}`,
      submitAll: 'जो नहीं भेजे, सब भेजें',
      submit: 'Meta को भेजें',
      copy: 'बॉडी कॉपी करें',
      copied: 'बॉडी कॉपी हुई',
      name: 'टेम्पलेट का नाम',
      category: 'कैटेगरी',
      language: 'भाषा',
      body: 'बॉडी',
      params: 'पैरामीटर, क्रम से',
      example: 'उदाहरण',
      preview: 'ग्राहक पढ़ते हैं',
      reason: (r: string) => `Meta की वजह: ${r}`,
      authNote:
        'साइन-इन कोड Authentication टेम्पलेट है। इसे WhatsApp Manager में कॉपी-कोड बटन के साथ बनाएं; इसके शब्द Meta लिखता है।',
      utility: 'Utility',
      authentication: 'Authentication',
      status: {
        approved: 'मंज़ूर',
        pending: 'जांच बाकी',
        rejected: 'नामंज़ूर',
        not_submitted: 'नहीं भेजा',
      },
      loading: 'टेम्पलेट लोड हो रहे हैं…',
    },
    messages: {
      title: 'मैसेज',
      intro: 'आपके स्टोर ने WhatsApp पर जो भी मैसेज भेजा या भेजने की कोशिश की, नया पहले।',
      resource: { singular: 'मैसेज', plural: 'मैसेज' },
      columns: {
        message: 'मैसेज',
        to: 'किसे',
        order: 'ऑर्डर',
        status: 'स्टेटस',
        sent: 'भेजा',
        error: 'क्या गड़बड़ हुई',
      },
      filter: { all: 'सभी', sent: 'भेजे गए', failed: 'फ़ेल', queued: 'कतार में' },
      status: { sent: 'भेजा', failed: 'फ़ेल', queued: 'कतार में' },
      empty: 'अभी कोई WhatsApp मैसेज नहीं। ऑर्डर अपडेट जाने पर यहां दिखेंगे।',
      more: 'और दिखाएं',
    },
  }),
]
