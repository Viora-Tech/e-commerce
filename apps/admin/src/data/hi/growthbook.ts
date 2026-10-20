import { growthbookContent } from '@/data/growthbook'
import { translation } from '@/lib/i18n'

export default [
  translation(growthbookContent, {
    title: 'GrowthBook',
    subtitle: 'अपने स्टोर पर A/B टेस्ट करें: अलग-अलग ग्राहकों को अलग बैनर और सेक्शन दिखाएँ।',
    save: 'सेव करें',
    discard: 'छोड़ें',
    unsaved: 'बिना सेव किए बदलाव',
    saved: 'सेव हो गया',
    failed: 'सेव नहीं हो पाया। फिर से कोशिश करें।',
    status: {
      listing: 'चालू है। analytics की अनुमति देने वाले ग्राहक आपके वेरिएंट में बँटते हैं।',
      assigning:
        'चालू है। analytics की अनुमति देने वाले ग्राहक आपके वेरिएंट में बँटते हैं। अपने एक्सपेरिमेंट यहाँ देखने के लिए secret key जोड़ें।',
      notSetUp: 'अभी सेट नहीं हुआ। नीचे अपना GrowthBook पता और client key जोड़ें।',
      open: 'GrowthBook खोलें',
    },
    connect: {
      title: 'GrowthBook जोड़ें',
      description:
        'GrowthBook एक मुफ़्त, ओपन-सोर्स A/B टेस्टिंग टूल है। GrowthBook Cloud या अपना GrowthBook सर्वर इस्तेमाल करें।',
      apiHost: {
        label: 'API host',
        help: 'जहाँ से GrowthBook features देता है। GrowthBook Cloud: cdn.growthbook.io लिखें। अपना सर्वर: उसका API पता, जैसे https://growthbook-api.yourstore.in.',
        placeholder: 'cdn.growthbook.io',
      },
      clientKey: {
        label: 'Client key',
        help: 'GrowthBook में: SDK Connections → आपका connection → Client key. यह sdk- से शुरू होती है।',
        placeholder: 'sdk-AbC123xyz',
      },
      decryptionKey: {
        label: 'Decryption key',
        help: 'सिर्फ़ तब, जब SDK connection अपने features encrypt करता हो। वरना खाली छोड़ें।',
        placeholder: 'encrypt नहीं है तो खाली छोड़ें',
      },
      appUrl: {
        label: 'GrowthBook पता',
        help: 'जहाँ आप GrowthBook में sign in करते हैं, "GrowthBook खोलें" लिंक के लिए। GrowthBook Cloud के लिए ज़रूरी नहीं।',
        placeholder: 'https://growthbook.yourstore.in',
      },
      secretKey: {
        label: 'Secret API key',
        help: 'ज़रूरी नहीं। इससे यह पेज आपके एक्सपेरिमेंट दिखा पाता है। GrowthBook में: Settings → API keys → New secret key, read-only role के साथ।',
        placeholder: 'key पेस्ट करें',
        saved: 'एक key सेव है। बदलने के लिए नई key पेस्ट करें।',
        remove: 'key हटाएँ',
        removed: 'Secret key हटा दी गई',
      },
      test: 'कनेक्शन जाँचें',
      testOk: (features: number, experiments: number | null) =>
        experiments === null
          ? `जुड़ गया: ${features} features मिले`
          : `जुड़ गया: ${features} features और ${experiments} एक्सपेरिमेंट मिले`,
    },
    howTo: {
      title: 'किसी सेक्शन का टेस्ट कैसे करें',
      steps: [
        'GrowthBook में एक feature बनाएँ और उसमें Experiment rule जोड़ें। एक्सपेरिमेंट की tracking key कॉपी करें, जैसे hero-test.',
        'Online store → Customize में, जिस सेक्शन का टेस्ट करना है उसके दो रूप जोड़ें, जैसे दो hero बैनर।',
        'हर सेक्शन पर Advanced → A/B test खोलें। tracking key लिखें, और एक सेक्शन पर 0 (control) और दूसरे पर 1 लिखें।',
        'GrowthBook में एक्सपेरिमेंट शुरू करें। analytics की अनुमति देने वाले हर ग्राहक को अब एक रूप दिखता है, हर बार वही। बाकी सबको control दिखता है।',
      ],
      prices:
        'कीमतों का टेस्ट कभी नहीं होता: एक ही प्रोडक्ट के लिए हर ग्राहक एक ही कीमत देता है, जैसा क़ानून और GST इनवॉइस चाहते हैं।',
    },
    experiments: {
      title: 'एक्सपेरिमेंट',
      description: 'GrowthBook से। नतीजे और फ़ैसले GrowthBook में ही रहते हैं।',
      empty: 'अभी कोई एक्सपेरिमेंट नहीं। GrowthBook में एक बनाएँ।',
      noKey: 'अपने एक्सपेरिमेंट यहाँ देखने के लिए ऊपर secret API key जोड़ें।',
      notConnected: 'अपने एक्सपेरिमेंट यहाँ देखने के लिए ऊपर GrowthBook जोड़ें।',
      error: 'एक्सपेरिमेंट लोड नहीं हो पाए',
      loading: 'एक्सपेरिमेंट लोड हो रहे हैं…',
      trackingKey: 'Tracking key',
      variations: 'वेरिएंट',
      started: (date: string) => `${date} को शुरू हुआ`,
      open: 'GrowthBook में खोलें',
      status: {
        running: 'चल रहा है',
        draft: 'ड्राफ़्ट',
        stopped: 'रुका हुआ',
      },
      result: {
        won: 'जीता',
        lost: 'हारा',
        dnf: 'पूरा नहीं हुआ',
        inconclusive: 'कोई साफ़ नतीजा नहीं',
      },
    },
    credit: 'GrowthBook ओपन सोर्स है (MIT लाइसेंस), GrowthBook, Inc. ने बनाया है।',
  }),
]
