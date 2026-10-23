import {
  campaignPerformanceContent,
  growthRecommendationsContent,
  growthSplitContent,
  linkQrContent,
} from '@/data/growth-report'
import { translation } from '@/lib/i18n'

export default [
  translation(growthRecommendationsContent, {
    title: 'सुझाव',
    subtitle: 'आपके स्टोर के अपने आंकड़ों से चुने गए अगले कदम।',
    empty: 'अभी कोई सुझाव नहीं। आंकड़े बदलने पर नए सुझाव यहाँ दिखेंगे।',
    dismiss: 'हटाएं',
    dismissed: 'सुझाव हटा दिया',
    created: 'ऑटोमेशन बन गया। मैसेज देख लें, फिर इसे चालू करें।',
    actions: {
      create: 'सेट करें',
      open: 'ऑटोमेशन खोलें',
      campaign: 'कैंपेन बनाएं',
      links: 'लिंक देखें',
    },
    cards: {
      abandoned_checkout: {
        title: 'छोड़े हुए चेकआउट वापस पाएँ',
        reason: (carts: string, value: string) =>
          `पिछले 7 दिनों में ${value} के ${carts} चेकआउट छोड़े गए, और कोई रिमाइंडर नहीं जाता।`,
      },
      cod_confirmation: {
        title: 'कैश ऑन डिलीवरी ऑर्डर WhatsApp पर कन्फ़र्म करें',
        reason: (cod: string, total: string, share: string) =>
          `पिछले 30 दिनों के ${total} ऑर्डर में से ${cod} (${share}) कैश ऑन डिलीवरी थे। छोटा सा कन्फ़र्मेशन रिटर्न घटाता है।`,
      },
      win_back: {
        title: 'पुराने ग्राहकों को वापस लाएँ',
        reason: (customers: string) =>
          `${customers} सब्सक्राइब किए ग्राहकों ने 90 दिनों से ऑर्डर नहीं किया।`,
      },
      welcome: {
        title: 'नए सब्सक्राइबर का स्वागत करें',
        reason: (last30: string, previous30: string) =>
          `पिछले 30 दिनों में ${last30} लोगों ने सब्सक्राइब किया (उससे पहले के 30 दिनों में ${previous30}), और उनका स्वागत कोई नहीं करता।`,
      },
      campaign: {
        title: 'कैंपेन भेजें',
        reason: (subscribers: string, days: string | null) =>
          days === null
            ? `आपके ${subscribers} सब्सक्राइबर हैं और अभी तक कोई कैंपेन नहीं भेजा।`
            : `आपका आख़िरी कैंपेन ${days} दिन पहले गया था। तब से ${subscribers} सब्सक्राइबर को आपसे कुछ नहीं मिला।`,
      },
      links_no_orders: {
        title: 'लिंक पर क्लिक आ रहे हैं, ऑर्डर नहीं',
        reason: (name: string, clicks: string) =>
          `“${name}” पर पिछले 30 दिनों में ${clicks} क्लिक आए, पर अभी तक कोई ऑर्डर नहीं। देखें कि यह कौन सा पेज खोलता है।`,
      },
    },
  }),
  translation(growthSplitContent, {
    newBuyers: 'पहली बार',
    returning: 'दोबारा',
    orders: (n: string) => `${n} ऑर्डर`,
    filter: {
      label: 'चैनल',
      all: 'सभी',
      paid: 'पेड',
      organic: 'ऑर्गेनिक',
      empty: 'इस रेंज में इस तरह का कोई चैनल नहीं।',
    },
  }),
  translation(campaignPerformanceContent, {
    funnel: {
      title: 'फ़नल',
      subtitle: 'भेजने से लेकर उससे आए ऑर्डर तक।',
      steps: {
        sent: 'भेजे गए',
        delivered: 'पहुँचे',
        opened: 'खोले गए',
        visited: 'स्टोर पर आए',
        carted: 'कार्ट में डाला',
        ordered: 'ऑर्डर किया',
      },
      ofPrevious: (pct: string) => `पिछले कदम का ${pct}`,
      omitted: {
        opened: 'WhatsApp खोले जाने की जानकारी नहीं देता, इसलिए यह कदम नहीं दिखाया।',
        carted: 'इस कैंपेन के लिए कार्ट ट्रैक नहीं होते, इसलिए यह कदम नहीं दिखाया।',
      },
      help: 'पहुँचे का मतलब है प्रोवाइडर ने मैसेज ले लिया। विज़िट वे स्टोर सेशन हैं जो इसके किसी लिंक से शुरू हुए।',
    },
    rates: {
      title: 'डिलीवरी और जुड़ाव',
      delivery: 'डिलीवरी रेट',
      bounce: 'बाउंस रेट',
      unsubscribe: 'अनसब्सक्राइब रेट',
      complaint: 'स्पैम शिकायतें',
      open: 'ओपन रेट (अनुमान)',
      of: (part: string, whole: string) => `${whole} में से ${part}`,
      notReported: 'यह चैनल इसकी जानकारी नहीं देता',
      openNote: 'Apple Mail और कुछ दूसरे ऐप हर ईमेल पहुँचते ही खोल देते हैं, इसलिए ओपन को अनुमान मानें।',
      unsubscribeNote: (days: number) => `जिन्होंने ${days} दिनों के अंदर अनसब्सक्राइब किया।`,
    },
    links: {
      title: 'लिंक',
      subtitle:
        'ईमेल यह नहीं बताते कि कौन सा लिंक दबाया गया, इसलिए विज़िट उस पेज के हिसाब से गिनी गई हैं जो लिंक ने खोला।',
      columns: { link: 'पेज', visits: 'विज़िट', orders: 'ऑर्डर', sales: 'बिक्री' },
      empty: 'इस कैंपेन से अभी कोई विज़िट नहीं।',
    },
    split: {
      title: 'पहली बार बनाम दोबारा',
      newBuyers: 'पहली बार के खरीदार',
      returning: 'दोबारा आए खरीदार',
      orders: (n: string) => `${n} ऑर्डर`,
      empty: 'इस कैंपेन से अभी कोई ऑर्डर नहीं।',
    },
  }),
  translation(linkQrContent, {
    menu: 'QR कोड',
    title: (name: string) => `${name} का QR कोड`,
    body: 'इसे पैकेजिंग, पर्चों या काउंटर पर छापें। हर स्कैन इस लिंक पर एक क्लिक गिना जाता है।',
    png: 'PNG डाउनलोड करें',
    svg: 'SVG डाउनलोड करें',
    close: 'बंद करें',
    failed: 'QR कोड नहीं बन पाया।',
    alt: (url: string) => `QR कोड जो ${url} खोलता है`,
  }),
]
