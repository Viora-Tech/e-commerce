import { seoReportContent } from '@/data/seo-report'
import { translation } from '@/lib/i18n'

export default [
  translation(seoReportContent, {
    title: 'SEO',
    subtitle:
      'Google, Bing और AI सर्च (ChatGPT, Perplexity) आपके प्रोडक्ट, कलेक्शन और पेज कितनी अच्छी तरह ढूंढ और दिखा पाते हैं।',
    unavailable: {
      heading: 'SEO रिपोर्ट उपलब्ध नहीं',
      body: 'इसकी SEO रिपोर्ट देखने के लिए आपको ऑनलाइन स्टोर का एक्सेस चाहिए।',
    },
    score: {
      label: 'SEO स्कोर',
      outOf: '100 में से',
      good: 'अच्छा है',
      fair: 'कुछ चीज़ें ठीक करनी हैं',
      poor: 'काम की ज़रूरत है',
      checked: (products: number, collections: number, pages: number) =>
        `${products} लाइव प्रोडक्ट, ${collections} कलेक्शन और ${pages} पब्लिश पेज जांचे गए।`,
      counts: (high: number, medium: number, low: number) =>
        `${high} ज़्यादा असर · ${medium} मध्यम · ${low} कम`,
    },
    fix: {
      heading: 'AI से ठीक करें',
      body: 'जो कमी है वो AI लिख देगा। बदलाव देखकर Apply दबाने तक कुछ सेव नहीं होता।',
      seo: (n: number) => `सर्च टाइटल और डिस्क्रिप्शन लिखें (${n})`,
      altText: (n: number) => `फ़ोटो का alt टेक्स्ट लिखें (${n})`,
      description: (n: number) => `प्रोडक्ट डिस्क्रिप्शन और विस्तार से लिखें (${n})`,
      capped: (max: number) => `एक बार में ${max} प्रोडक्ट तक। बाकी के लिए फिर से चलाएं।`,
      off: 'इन्हें अपने-आप ठीक करने के लिए Settings → AI में Write with AI चालू करें।',
      nothing: 'अभी AI के लिखने के लिए कुछ नहीं है।',
    },
    issues: {
      heading: 'ठीक करने लायक चीज़ें',
      body: 'सबसे ज़रूरी पहले। हाथ से ठीक करने के लिए आइटम खोलें।',
      empty: 'ठीक करने को कुछ नहीं। जांची गई हर चीज़ अच्छी है।',
      filters: { all: 'सभी', high: 'ज़्यादा असर', medium: 'मध्यम', low: 'कम' },
      severity: { high: 'ज़्यादा', medium: 'मध्यम', low: 'कम' },
      resource: { product: 'प्रोडक्ट', collection: 'कलेक्शन', page: 'पेज', menu: 'मेन्यू' },
      edit: 'बदलें',
      more: (n: number) => `${n} और दिखाएं`,
    },
    kinds: {
      title_missing: () => 'कोई सर्च टाइटल नहीं।',
      title_long: (d: string | null) => `सर्च टाइटल ${d} अक्षर का है; Google लगभग 60 दिखाता है।`,
      title_short: (d: string | null) => `सर्च टाइटल सिर्फ़ ${d} अक्षर का है; थोड़ा और लिखें।`,
      title_duplicate: (d: string | null) => `सर्च टाइटल “${d}” जैसा ही है।`,
      description_missing: () => 'न सर्च डिस्क्रिप्शन है, न कोई टेक्स्ट जिससे बन सके।',
      description_long: (d: string | null) =>
        `सर्च डिस्क्रिप्शन ${d} अक्षर का है; Google लगभग 160 दिखाता है।`,
      description_short: (d: string | null) => `सर्च डिस्क्रिप्शन सिर्फ़ ${d} अक्षर का है; 70 से 160 रखें।`,
      description_duplicate: (d: string | null) => `सर्च डिस्क्रिप्शन “${d}” जैसा ही है।`,
      image_missing: () => 'कोई फ़ोटो नहीं। बिना फ़ोटो वाले प्रोडक्ट इमेज और शॉपिंग नतीजों में कम दिखते हैं।',
      alt_missing: (d: string | null) => `${d} फ़ोटो में alt टेक्स्ट नहीं है।`,
      content_thin: (d: string | null) =>
        `डिस्क्रिप्शन में ${d} शब्द हैं; 50 या ज़्यादा से सर्च और AI जवाबों में मदद मिलती है।`,
      shopping_brand_missing: () => 'Google Shopping के लिए ब्रांड (vendor) नहीं है।',
      shopping_gtin_missing: () => 'Google Shopping के लिए किसी वेरिएंट पर बारकोड (GTIN) नहीं है।',
      handle_bad: (d: string | null) =>
        `वेब पता “${d}” छोटा, lowercase और hyphen से जुड़े शब्दों में होना चाहिए।`,
      link_broken: (d: string | null) =>
        `${d} का लिंक कहीं नहीं जाता: वह पेज अब नहीं है। लिंक ठीक करें या redirect जोड़ें।`,
      link_old_store: (d: string | null) =>
        `लिंक अब भी आपके पुराने Shopify स्टोर (${d}) पर जाता है; वह स्टोर बंद होने पर टूट जाएगा।`,
      collection_empty: () => 'इस कलेक्शन में कोई लाइव प्रोडक्ट नहीं; शॉपर और Google को खाली पेज मिलता है।',
      collection_image_missing: () => 'सर्च नतीजों और सोशल शेयर के लिए कलेक्शन इमेज नहीं है।',
      category_missing: () => 'प्रोडक्ट कैटेगरी नहीं है; Google Shopping इससे प्रोडक्ट को सही जगह रखता है।',
      page_thin: (d: string | null) =>
        `पेज में ${d} शब्द हैं; थोड़ा और लिखने से सर्च और AI जवाबों में मदद मिलती है।`,
    },
  }),
]
