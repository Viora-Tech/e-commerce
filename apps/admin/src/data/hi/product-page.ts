import { productPageContent } from '@/data/product-page'
import { translation } from '@/lib/i18n'

export default [
  translation(productPageContent, {
    apps: {
      openApp: 'ऐप खोलें',
      unsaved: 'आपके ऐप इस प्रोडक्ट में क्या जोड़ते हैं, यह देखने के लिए प्रोडक्ट सेव करें।',
      emptyHeading: 'अभी कोई ऐप यहाँ कुछ नहीं जोड़ता',
      emptyBody:
        'रिव्यू, बैक इन स्टॉक और GST इनवॉइस जैसे ऐप हर प्रोडक्ट में अपना सेक्शन जोड़ते हैं। कोई ऐप इंस्टॉल करें, वह यहाँ दिखेगा।',
      browse: 'ऐप स्टोर देखें',
      failed: 'यह सेक्शन लोड नहीं हो पाया।',
    },
    actions: {
      archive: 'प्रोडक्ट आर्काइव करें',
      unarchive: 'प्रोडक्ट आर्काइव से हटाएं',
      viewReviews: 'इस प्रोडक्ट के रिव्यू देखें',
      backInStock: 'देखें कौन इस प्रोडक्ट का इंतज़ार कर रहा है',
      editGst: 'HSN कोड और GST रेट बदलें',
      searchPerformance: 'Google सर्च में प्रदर्शन देखें',
    },
    reviews: {
      count: (n) => `${n} रिव्यू`,
      empty: 'इस प्रोडक्ट का अभी कोई रिव्यू नहीं है।',
      anonymous: 'अनाम',
      viewAll: 'सभी रिव्यू देखें',
    },
    backInStock: {
      waiting: (n) => `${n} ग्राहक दोबारा स्टॉक आने का इंतज़ार कर रहे हैं`,
      pending: (n) => `${n} ने अभी पुष्टि नहीं की`,
      empty: 'किसी ने इस प्रोडक्ट के वापस आने की सूचना नहीं माँगी है।',
      variantWaiting: (n) => `${n} इंतज़ार में`,
      viewAll: 'सभी अनुरोध देखें',
    },
    gst: {
      hsCode: 'HSN कोड',
      gstRate: 'GST रेट',
      notSet: 'सेट नहीं',
      storeRate: 'स्टोर रेट',
      rate: (n) => `${n}%`,
      help: 'इस प्रोडक्ट के हर GST इनवॉइस पर छपता है।',
      edit: 'शिपिंग में बदलें',
    },
    social: {
      heading: 'सोशल शेयर प्रीव्यू',
      google: 'Google',
      imageHelp:
        'शेयर किए गए लिंक में प्रोडक्ट की मुख्य फ़ोटो दिखती है। बदलने के लिए ओवरव्यू में किसी और फ़ोटो को पहले स्थान पर रखें।',
      noImage: 'ओवरव्यू में फ़ोटो जोड़ें ताकि शेयर किए गए लिंक में तस्वीर दिखे।',
    },
    checklist: {
      apps: (n) => `${n} ऐप`,
      noApps: 'कोई ऐप नहीं',
    },
  }),
]
