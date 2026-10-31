import { siteConfig } from '@commerce/config/site'
import { mcpContent } from '@/data/mcp'
import { translation } from '@/lib/i18n'

const brand = siteConfig.brand.name

export default [
  translation(mcpContent, {
    title: 'MCP और API',
    subtitle: (store) =>
      `Claude, Claude Code, ChatGPT और Cursor जैसे AI ऐप को ${store} के साथ काम करने दें। वे उसी व्यक्ति की तरह काम करते हैं जिसने उन्हें जोड़ा, और उसके रोल से ज़्यादा कभी नहीं करते।`,
    save: 'सेव करें',
    saved: 'सेव हो गया',
    saveFailed: 'सेव नहीं हुआ। फिर कोशिश करें।',
    status: {
      connected: (n) => `${n} AI ऐप जुड़े हैं`,
      notConnected: 'अभी कोई ऐप नहीं जुड़ा',
      notConnectedBody: 'नीचे अपना AI ऐप चुनें और स्टेप पूरे करें। लगभग 2 मिनट लगते हैं।',
      live: 'चालू',
      waiting: 'ऐप का इंतज़ार',
      lastRequest: (ago) => `आख़िरी रिक्वेस्ट ${ago}`,
      noRequests: 'अभी कोई रिक्वेस्ट नहीं',
      url: 'MCP सर्वर URL',
      urlHelp:
        'हर पते के अपने कनेक्शन होते हैं। जो ऐप आपने किसी दूसरे पते (जैसे लाइव एडमिन) से जोड़ा है, वह उसी एडमिन में दिखेगा, यहाँ नहीं।',
      signIn: 'साइन-इन',
      signInValue: `${brand} साइन-इन (OAuth) या API टोकन`,
      limits: 'लिमिट',
      limitsValue: (n) => `हर ऐप के लिए ${n} रिक्वेस्ट / मिनट`,
    },
    server: {
      url: 'सर्वर URL',
      copy: 'सर्वर URL कॉपी करें',
      copied: 'कॉपी हो गया',
    },
    guide: {
      heading: 'AI ऐप जोड़ें',
      help: 'जो ऐप आप इस्तेमाल करते हैं उसे चुनें। हर ऐप एक ही सर्वर URL और एक ही मंज़ूरी के नियम इस्तेमाल करता है।',
      tabs: {
        claude: 'Claude',
        claudeCode: 'Claude Code',
        chatgpt: 'ChatGPT',
        cursor: 'Cursor',
        vscode: 'VS Code',
        other: 'दूसरे MCP ऐप',
      },
      copyWhat: 'कमांड',
      copyJson: 'कॉन्फ़िग',
      copyHeader: 'हेडर',
      privateUrl:
        'यह पता सिर्फ़ इसी कंप्यूटर पर काम करता है, इसलिए वेब ऐप (claude.ai, ChatGPT) इस तक नहीं पहुँच सकते। यहाँ Claude Code, Cursor या VS Code इस्तेमाल करें, या वेब ऐप अपने लाइव एडमिन से जोड़ें।',
      claude: {
        steps: [
          { title: 'सर्वर URL कॉपी करें', body: 'ऊपर MCP सर्वर URL के पास Copy दबाएं।' },
          {
            title: 'Claude में कस्टम कनेक्टर जोड़ें',
            body: 'claude.ai पर: Settings → Connectors → Add custom connector। URL पेस्ट करें और अपने स्टोर का नाम दें। यह Claude Desktop और मोबाइल ऐप में भी दिखता है।',
          },
          {
            title: `${brand} से साइन इन करें`,
            body: 'Claude साइन-इन पेज खोलता है। चुनें कि Claude किन हिस्सों को इस्तेमाल कर सकता है, फिर Allow दबाएँ।',
          },
        ],
        open: 'Claude कनेक्टर खोलें',
      },
      claudeCode: {
        steps: [
          {
            title: 'सर्वर जोड़ें',
            body: 'इसे अपने टर्मिनल में चलाएँ। हर प्रोजेक्ट में इस्तेमाल करने के लिए --scope user जोड़ें।',
          },
          {
            title: `${brand} से साइन इन करें`,
            body: 'Claude Code शुरू करें, /mcp लिखें, सर्वर चुनें और Authenticate दबाएँ। ब्राउज़र में साइन-इन पेज खुलेगा।',
          },
          {
            title: 'आज़माएँ',
            body: '"कल क्या बिका?" पूछें। अब Claude Code में स्टोर के टूल दिखते हैं।',
          },
        ],
      },
      chatgpt: {
        steps: [
          {
            title: 'डेवलपर मोड चालू करें',
            body: 'ChatGPT में: Settings → Apps & Connectors → Advanced settings → Developer mode। यह ChatGPT के पेड प्लान पर मिलता है।',
          },
          {
            title: 'कनेक्टर बनाएँ',
            body: 'Create दबाएँ, सर्वर URL पेस्ट करें और ऑथेंटिकेशन में OAuth चुनें।',
          },
          {
            title: `${brand} से साइन इन करें`,
            body: 'ChatGPT साइन-इन पेज खोलता है। हर बदलाव भेजने से पहले ChatGPT भी आपसे पुष्टि माँगता है।',
          },
        ],
        supported:
          'सपोर्टेड: सर्वर OAuth साइन-इन के साथ Streamable HTTP इस्तेमाल करता है, जो ChatGPT डेवलपर मोड को चाहिए।',
        open: 'ChatGPT सेटिंग खोलें',
      },
      cursor: {
        steps: [
          {
            title: 'सर्वर जोड़ें',
            body: 'Cursor में जोड़ें दबाएँ, या इसे ~/.cursor/mcp.json में पेस्ट करें।',
          },
          {
            title: `${brand} से साइन इन करें`,
            body: 'Cursor Settings → MCP में सर्वर "Needs login" दिखाता है। उसे दबाकर साइन इन करें।',
          },
        ],
        open: 'Cursor में जोड़ें',
      },
      vscode: {
        steps: [
          {
            title: 'सर्वर जोड़ें',
            body: 'VS Code में जोड़ें दबाएँ, या इसे अपने प्रोजेक्ट की .vscode/mcp.json में पेस्ट करें।',
          },
          {
            title: `${brand} से साइन इन करें`,
            body: 'Copilot एजेंट मोड पहली बार सर्वर इस्तेमाल करे तो VS Code साइन इन करने को कहता है।',
          },
        ],
        open: 'VS Code में जोड़ें',
      },
      other: {
        steps: [
          {
            title: 'सर्वर URL जोड़ें',
            body: 'ट्रांसपोर्ट: Streamable HTTP। ज़्यादातर ऐप ऐसा कॉन्फ़िग लेते हैं।',
          },
          {
            title: 'सिर्फ़ लोकल सर्वर चलाने वाले ऐप',
            body: 'सर्वर से जोड़ने के लिए mcp-remote इस्तेमाल करें, इसके लिए Node.js चाहिए।',
          },
          {
            title: `${brand} से साइन इन करें`,
            body: 'जो ऐप MCP साइन-इन सपोर्ट करते हैं, वे पेज खुद खोलते हैं। बाकी API टोकन भेज सकते हैं (नीचे)।',
          },
        ],
      },
      capabilities: {
        heading: 'AI ऐप क्या कर सकते हैं',
        tools: [
          {
            title: 'तुरंत पढ़ना',
            body: 'findProducts, orderDetails, salesSummary, lowStock और बाकी तुरंत जवाब देते हैं।',
          },
          {
            title: 'सुझाव',
            body: 'proposeProductUpdate, proposeDiscount, proposeCollection और बाकी आपके रोल से बदलाव करते हैं, या जब आपके रोल को मंज़ूरी चाहिए तो उसे मंज़ूरी के लिए भेजते हैं।',
          },
          {
            title: 'एडमिन का हर काम',
            body: 'searchActions काम ढूँढता है, describeAction उसके इनपुट और मंज़ूरी की ज़रूरत बताता है, runAction उसे चलाता है।',
          },
        ],
        rules: [
          { title: 'पढ़ना', body: 'तुरंत होता है।' },
          {
            title: 'बदलाव',
            body: 'जोड़ने वाले सदस्य के रोल से चलते हैं, या जब उनके रोल को मंज़ूरी चाहिए तो सेटिंग्स → मंज़ूरियाँ में रुकते हैं।',
          },
          {
            title: 'संवेदनशील',
            body: 'रिफ़ंड, कैंसलेशन, डिलीट, और पेमेंट, स्टाफ़, बिलिंग और डोमेन की सेटिंग हमेशा मंज़ूरी का इंतज़ार करती हैं।',
          },
          {
            title: 'कभी नहीं',
            body: 'आपकी तरह साइन इन करना, टोकन बनाना या हटाना, या अपने ही बदलाव मंज़ूर करना।',
          },
        ],
        reconnect: 'इस अपडेट से पहले कोई ऐप जोड़ा था? उसे फिर से जोड़ें या रीस्टार्ट करें, ताकि उसे हर काम दिखे।',
      },
      token: {
        heading: 'इसकी जगह API टोकन इस्तेमाल करें',
        body: 'उन ऐप के लिए जो साइन-इन पेज नहीं खोल सकते। टोकन बनाएँ, फिर हर रिक्वेस्ट के साथ इसे इस हेडर में भेजें। टोकन के बदलाव आपके रोल के हिसाब से तुरंत होते हैं।',
        withToken: 'टोकन के साथ',
        placeholder: 'YOUR_API_TOKEN',
        create: 'API टोकन बनाएँ',
      },
    },
    connected: {
      heading: 'जुड़े हुए AI ऐप',
      help: 'हर ऐप जिसने साइन इन किया, और हर API टोकन जो इस्तेमाल हुआ है। जिसे आप नहीं पहचानते, उसे हटा दें।',
      app: 'ऐप',
      connectedBy: 'किसने जोड़ा',
      canDo: 'क्या कर सकता है',
      lastUsed: 'आख़िरी इस्तेमाल',
      viaOAuth: 'OAuth से साइन इन',
      viaToken: (hint) => `API टोकन · ${hint}`,
      lapsed: 'साइन-इन खत्म, ऐप में फिर से जोड़ें',
      tokenRuns: 'बदलाव तुरंत होते हैं',
      disconnect: 'हटाएँ',
      emptyTitle: 'कोई AI ऐप नहीं जुड़ा',
      emptyBody: 'ऊपर की गाइड से जोड़ें। साइन इन करते ही यह यहाँ दिखेगा।',
    },
    permissions: {
      heading: 'अनुमतियाँ और मंज़ूरी',
      help: 'ये साइन इन करने वाले हर ऐप पर लागू होती हैं। API टोकन अपने हिस्सों के हिसाब से चलते हैं।',
      rules: {
        reads: 'पढ़ना तुरंत होता है।',
        changesOff: 'बदलाव बंद हैं, इसलिए ऐप सिर्फ़ पढ़ सकते हैं।',
        changesDirect:
          'ऐप के माँगते ही बदलाव आपके रोल के हिसाब से हो जाते हैं। जिनके लिए आपके रोल को मंज़ूरी चाहिए, वे सेटिंग्स → मंज़ूरियाँ में रुकते हैं।',
        sensitive:
          'संवेदनशील काम हमेशा मंज़ूरी का इंतज़ार करते हैं: रिफ़ंड, कैंसलेशन, डिलीट, और पेमेंट, स्टाफ़, बिलिंग और डोमेन की सेटिंग।',
        customersOn: 'ऐप ग्राहकों के नाम, फ़ोन नंबर और पते पढ़ सकते हैं।',
        customersOff: 'ग्राहकों के नाम, फ़ोन नंबर और पते छिपे रहते हैं।',
      },
    },
    switches: {
      allowChanges: 'AI ऐप को बदलाव करने दें',
      allowChangesHelp:
        'बंद होने पर ऐप सिर्फ़ पढ़ सकते हैं। चालू करें ताकि वे प्रोडक्ट और ऑर्डर से लेकर थीम और सेटिंग तक, एडमिन का हर वह काम कर सकें जिसकी आपका रोल इजाज़त देता है।',
      readCustomers: 'ऐप को ग्राहकों की जानकारी पढ़ने दें',
      readCustomersHelp: 'नाम, फ़ोन नंबर और पते। डिफ़ॉल्ट रूप से बंद; ऑर्डर में शहर फिर भी दिखता है।',
    },
    table: {
      memberLine: (role, date) => `${role} · ${date}`,
      removedMember: 'अब टीम में नहीं',
      never: 'अभी नहीं',
      from: (ip) => `${ip} से`,
      stopped: 'काम करना बंद',
      revoke: 'हटाएँ',
      tokensHeading: 'API टोकन',
      tokensHelp:
        'स्क्रिप्ट, सर्वर और उन AI ऐप के लिए जो साइन इन नहीं कर सकते। लोग साइन इन करें, ताकि उनकी अपनी स्टाफ़ अनुमतियाँ लागू हों।',
      createToken: 'टोकन बनाएँ',
      name: 'नाम',
      scopes: 'दायरा',
      expires: 'समाप्ति',
      expiresNever: 'कभी नहीं',
      expired: (date) => `${date} को समाप्त`,
      lastUsed: 'आख़िरी इस्तेमाल',
      noTokens: 'अभी कोई API टोकन नहीं',
      noTokensBody: 'किसी स्क्रिप्ट या सर्वर के लिए बनाएँ जिसे आपका स्टोर पढ़ना या अपडेट करना हो।',
    },
    canDo: {
      readAll: 'सब कुछ पढ़ सकता है',
      read: (areas) => `${areas} पढ़ सकता है`,
      readWrite: 'पढ़ना और लिखना',
      readOnly: 'सिर्फ़ पढ़ना',
      propose: (areas) => `${areas} के काम कर सकता है`,
      sensitiveApproval: 'संवेदनशील कामों को मंज़ूरी चाहिए',
    },
    areas: {
      products: 'प्रोडक्ट',
      orders: 'ऑर्डर',
      customers: 'ग्राहक',
      inventory: 'इन्वेंटरी',
      discounts: 'डिस्काउंट',
      content: 'कंटेंट',
      analytics: 'एनालिटिक्स',
      marketing: 'मार्केटिंग',
      online_store: 'ऑनलाइन स्टोर',
      settings: 'सेटिंग',
    },
    access: { read: 'पढ़ना', write: 'लिखना' },
    create: {
      title: 'API टोकन बनाएँ',
      intro: 'किसी स्क्रिप्ट, सर्वर या AI ऐप के लिए। उसे सिर्फ़ उतना दें जितना ज़रूरी है।',
      name: 'नाम',
      namePlaceholder: 'Inventory sync script',
      canAccess: 'क्या एक्सेस कर सकता है',
      expires: 'समाप्ति',
      expiry: { 30: '30 दिन में', 90: '90 दिन में', 365: '1 साल में', never: 'कभी नहीं' },
      note: 'टोकन आपके रोल के साथ तुरंत काम करते हैं और संवेदनशील सेटिंग नहीं बदल सकते। जिस बदलाव के लिए आपके रोल को मंज़ूरी चाहिए, वह सेटिंग्स → मंज़ूरियाँ में रुकता है। साइन इन करने वाले ऐप भी ऐसे ही चलते हैं, और उनके संवेदनशील काम हमेशा किसी व्यक्ति का इंतज़ार करते हैं।',
      cancel: 'रद्द करें',
      create: 'टोकन बनाएँ',
      creating: 'बन रहा है…',
      pickArea: 'कम से कम एक हिस्सा चुनें।',
      failed: 'टोकन नहीं बना। फिर कोशिश करें।',
    },
    shown: {
      title: 'अपना टोकन अभी कॉपी करें',
      intro: 'यह आपको दोबारा नहीं दिखेगा। इसे अपने सर्वर की सीक्रेट सेटिंग में रखें, कोड में कभी नहीं।',
      once: 'एक ही बार दिखेगा',
      label: 'API टोकन',
      copy: 'टोकन कॉपी करें',
      copied: 'कॉपी हो गया',
      name: 'नाम',
      canAccess: 'क्या एक्सेस कर सकता है',
      expires: 'समाप्ति',
      use: 'हर रिक्वेस्ट के साथ इसे ऐसे भेजें',
      claudeCode: 'या इसे Claude Code में जोड़ें',
      done: 'हो गया',
    },
    revoke: {
      title: (name) => `${name} हटाना है?`,
      disconnectTitle: (name) => `${name} को डिस्कनेक्ट करना है?`,
      client: (name, store, member) =>
        `${name} की ${store} तक पहुँच तुरंत बंद हो जाएगी। ${member} इसे बाद में फिर जोड़ सकते हैं। AI मंज़ूरियों में रुके बदलाव वहीं रहेंगे।`,
      token: (name) =>
        `"${name}" इस्तेमाल करने वाली हर चीज़ तुरंत बंद हो जाएगी। यह वापस नहीं होगा; ज़रूरत हो तो नया टोकन बनाएँ।`,
      keep: 'रहने दें',
      confirm: 'हटाएँ',
      disconnect: 'डिस्कनेक्ट करें',
      done: (name) => `${name} डिस्कनेक्ट हो गया`,
      failed: 'हटाया नहीं जा सका। फिर कोशिश करें।',
    },
    activity: {
      heading: 'गतिविधि',
      help: 'पिछले 90 दिनों में ऐप और टोकन ने जो पढ़ा या बदला। बदलाव अपनी मंज़ूरी से जुड़े हैं।',
      open: 'गतिविधि देखें',
      title: 'MCP गतिविधि',
      subtitle: (store) =>
        `पिछले 90 दिनों में AI ऐप और टोकन ने ${store} में जो किया। बदलाव अपनी मंज़ूरी से जुड़े हैं।`,
      back: 'MCP और API',
      export: 'CSV डाउनलोड करें',
      exportFailed: 'डाउनलोड नहीं हुआ। फिर कोशिश करें।',
      filters: {
        all: 'सब',
        read: 'पढ़ना',
        change: 'बदलाव',
        approval: 'मंज़ूरी बाकी',
        blocked: 'रोके गए',
      },
      today: 'आज',
      yesterday: 'कल',
      openApproval: 'मंज़ूरी खोलें',
      approvalStatus: {
        executed: 'मंज़ूर हुआ',
        failed: 'मंज़ूर हुआ, पर नहीं हो पाया',
        cancelled: 'रद्द',
        expired: 'मंज़ूरी से पहले समय खत्म: कुछ नहीं बदला',
        undone: 'मंज़ूर हुआ, बाद में वापस लिया',
      },
      loadOlder: 'पुरानी गतिविधि देखें',
      loading: 'लोड हो रहा है…',
      empty: 'अभी कुछ नहीं',
      emptyBody: 'जब कोई ऐप या टोकन कुछ पढ़ेगा या बदलेगा, वह यहाँ दिखेगा।',
      loadFailed: 'गतिविधि लोड नहीं हुई। फिर कोशिश करें।',
    },
    consent: {
      title: (client, store) => `${client} को ${store} इस्तेमाल करने दें?`,
      intro: (client, member) =>
        `${client} आपकी (${member}) तरह काम करेगा और आपकी भूमिका से ज़्यादा कभी नहीं करेगा।`,
      signedInAs: (email) => `${email} से साइन इन`,
      canAccess: (client) => `${client} क्या कर सकता है`,
      approvalNote: `रिफ़ंड, कैंसलेशन, डिलीट, और पेमेंट, स्टाफ़ और बिलिंग की सेटिंग हमेशा ${brand} में किसी व्यक्ति की मंज़ूरी का इंतज़ार करती हैं। बाकी बदलाव आपके रोल के हिसाब से होते हैं, जब तक आपके रोल को उनके लिए मंज़ूरी न चाहिए।`,
      allow: 'अनुमति दें',
      deny: 'मना करें',
      working: 'एक पल…',
      failed: 'कुछ गड़बड़ हुई। अपने AI टूल से फिर से जोड़ना शुरू करें।',
      pickArea: 'कम से कम एक हिस्सा चुनें।',
      invalid: 'यह साइन-इन लिंक सही नहीं है',
      invalidBody: 'अपने AI टूल से फिर से जोड़ना शुरू करें।',
      noStore: 'आप इस स्टोर के सदस्य नहीं हैं',
      noStoreBody: 'स्टोर से जुड़े अकाउंट से साइन इन करें, या उसके मालिक से इनवाइट माँगें।',
      returning: (client) => `${client} पर लौट रहे हैं…`,
    },
  }),
]
