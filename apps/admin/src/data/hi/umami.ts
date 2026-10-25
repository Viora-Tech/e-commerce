import { umamiContent } from '@/data/umami'
import { translation } from '@/lib/i18n'

export default [
  translation(umamiContent, {
    title: 'Umami',
    subtitle: 'देखें आपके स्टोर पर कौन आता है: विज़िटर, सबसे ज़्यादा देखे गए पेज, वे कहाँ से आए और भी बहुत कुछ।',
    save: 'सेव करें',
    discard: 'छोड़ें',
    unsaved: 'बिना सेव किए बदलाव',
    saved: 'सेव हो गया',
    failed: 'सेव नहीं हो पाया। फिर से कोशिश करें।',
    status: {
      reporting: 'विज़िटर गिने जा रहे हैं। उनके आँकड़े Analytics पेज पर दिखते हैं।',
      tracking: 'विज़िटर गिने जा रहे हैं। API key जोड़ें, ताकि Analytics पेज पर उनके आँकड़े दिख सकें।',
      notSetUp: 'अभी सेट नहीं हुआ। नीचे अपना Umami पता और वेबसाइट जोड़ें।',
      analyticsLink: 'Analytics खोलें',
    },
    connect: {
      title: 'Umami जोड़ें',
      description:
        'Umami एक मुफ़्त, ओपन-सोर्स analytics टूल है जो कोई कुकी नहीं रखता। Umami Cloud या अपना Umami सर्वर इस्तेमाल करें।',
      url: {
        label: 'Umami पता',
        help: 'जहाँ आपका Umami खुलता है, जैसे https://analytics.yourstore.in. Umami Cloud इस्तेमाल कर रहे हैं? cloud.umami.is लिखें।',
        placeholder: 'https://analytics.yourstore.in',
      },
      apiKey: {
        label: 'API key',
        help: 'इससे यह पेज आपके आँकड़े पढ़ पाता है। Umami में: Settings → API keys → Create key. Umami Cloud में: Settings → API keys.',
        placeholder: 'key यहाँ पेस्ट करें',
        saved: 'एक key सेव है। बदलने के लिए नई key पेस्ट करें।',
        remove: 'key हटाएँ',
        removed: 'API key हटा दी गई',
      },
      websiteId: {
        label: 'वेबसाइट id',
        help: 'Umami में अपनी वेबसाइट की सेटिंग खोलें और उसका Website ID कॉपी करें। या वेबसाइट हम आपके लिए बना दें।',
        placeholder: '4f1e2a7c-9b3d-4c5e-8f60-1a2b3c4d5e6f',
        create: 'इस स्टोर के लिए वेबसाइट बनाएँ',
        created: 'Umami में वेबसाइट बन गई',
        createNeeds: 'पहले Umami पता और API key जोड़ें।',
      },
      test: 'कनेक्शन जाँचें',
      testOk: (name: string) => `Umami में “${name}” से जुड़ गए`,
    },
    privacy: {
      title: 'प्राइवेसी',
      label: 'कुकी की मंज़ूरी का इंतज़ार करें',
      help: 'चालू: विज़िटर तभी गिने जाते हैं जब वे आपके कुकी बैनर पर analytics की इजाज़त दें। बंद: Umami कोई कुकी नहीं रखता, इसलिए विज़िटर तब तक गिने जाते हैं जब तक वे मना न करें।',
    },
    credit: 'Umami ओपन सोर्स है (MIT लाइसेंस), Umami Software का बनाया हुआ।',
    visitors: {
      title: 'विज़िटर',
      intro: 'Umami से: जिन लोगों ने आपका स्टोर खोला, उन्होंने कौन से पेज देखे और वे कहाँ से आए।',
      open: 'Umami में खोलें',
      trend: {
        title: 'समय के साथ विज़िटर',
        visitors: 'विज़िटर',
        pageviews: 'पेज व्यू',
        count: 'गिनती',
        subtitle: (visitors: string, span: string) => `${span} ${visitors} विज़िटर`,
      },
      kpis: {
        visitors: 'विज़िटर',
        visits: 'विज़िट',
        pageviews: 'पेज व्यू',
        bounceRate: 'एक पेज देखकर चले गए',
        visitDuration: 'औसत विज़िट',
      },
      lists: {
        pages: { title: 'सबसे ज़्यादा देखे गए पेज', empty: 'अभी कोई पेज व्यू नहीं।', none: '(अनजान पेज)' },
        referrers: {
          title: 'विज़िटर कहाँ से आए',
          empty: 'अभी कोई विज़िट नहीं।',
          none: 'सीधे या अनजान',
        },
        campaigns: {
          title: 'कैंपेन (UTM)',
          empty: 'टैग किए लिंक से अभी कोई विज़िट नहीं। अपने ऐड और पोस्ट के लिंक में ?utm_campaign=… जोड़ें।',
          none: 'कोई कैंपेन नहीं',
        },
        devices: { title: 'डिवाइस', empty: 'अभी कोई विज़िट नहीं।', none: 'अनजान' },
        browsers: { title: 'ब्राउज़र', empty: 'अभी कोई विज़िट नहीं।', none: 'अनजान' },
        countries: { title: 'देश', empty: 'अभी कोई विज़िट नहीं।', none: 'अनजान' },
      },
      devices: {
        desktop: 'डेस्कटॉप',
        laptop: 'लैपटॉप',
        mobile: 'फ़ोन',
        tablet: 'टैबलेट',
      },
      empty: {
        notInstalled: {
          title: 'देखें आपके स्टोर पर कौन आता है',
          body: 'Umami जोड़ें, एक मुफ़्त analytics टूल जो कोई कुकी नहीं रखता, और यहीं देखें विज़िटर, सबसे ज़्यादा देखे गए पेज, वे कहाँ से आए, कैंपेन, डिवाइस और देश।',
          action: 'Umami लें',
        },
        notConnected: {
          title: 'Umami जोड़ना पूरा करें',
          body: 'अपना Umami पता, वेबसाइट और एक API key जोड़ें, फिर विज़िटर के आँकड़े यहाँ दिखेंगे।',
          action: 'Umami जोड़ें',
        },
        error: { title: 'विज़िटर के आँकड़े लोड नहीं हो पाए', action: 'Umami सेटिंग देखें' },
      },
      loading: 'विज़िटर के आँकड़े लोड हो रहे हैं…',
      seconds: (s: number) =>
        s < 60 ? `${Math.round(s)} सेकंड` : `${Math.floor(s / 60)} मिनट ${Math.round(s % 60)} सेकंड`,
    },
  }),
]
