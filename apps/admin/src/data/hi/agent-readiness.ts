import { agentReadinessContent } from '@/data/agent-readiness'
import { translation } from '@/lib/i18n'

export default [
  translation(agentReadinessContent, {
    title: 'AI शॉपिंग एजेंट',
    intro:
      'क्या ChatGPT, Claude, Perplexity और दूसरे AI असिस्टेंट आपके प्रोडक्ट, दाम और स्टॉक देख पाते हैं। हम आपकी लाइव साइट जाँचते हैं।',
    run: 'अभी जाँचें',
    running: 'आपकी लाइव साइट जाँच रहे हैं…',
    checked: (when) => `${when} को जाँचा`,
    passed: (n, total) => `${total} में से ${n} ठीक`,
    noDomain: 'पहले अपना डोमेन जोड़ें। हम वही लाइव साइट जाँचते हैं जो ग्राहक खोलते हैं।',
    failed: 'साइट की जाँच नहीं हो सकी। थोड़ी देर में फिर कोशिश करें।',
    pass: 'ठीक',
    fail: 'ठीक करें',
    open: 'खोलें',
    checks: {
      bots_allowed: {
        title: 'AI असिस्टेंट आपके पेज खोल पाते हैं',
        fix: (names) =>
          `${names || 'AI बॉट'} रोके जा रहे हैं। Cloudflare में AI सर्च और असिस्टेंट के लिए “Block AI bots” बंद करें (AI Crawl Control)।`,
      },
      robots_allows_ai: {
        title: 'robots.txt AI असिस्टेंट को आने देता है',
        fix: (names) =>
          `robots.txt ${names || 'AI असिस्टेंट'} को रोकता है। Preferences में “Let AI crawlers read my store” चालू करें, और Cloudflare का managed robots.txt बंद करें।`,
      },
      llms_txt: {
        title: 'llms.txt असिस्टेंट को आपके कैटलॉग तक ले जाता है',
        fix: () => 'यह तब दिखता है जब Preferences में AI crawlers की अनुमति हो और पासवर्ड पेज बंद हो।',
      },
      sitemap_products: {
        title: 'साइटमैप में आपके प्रोडक्ट हैं',
        fix: () =>
          'साइटमैप में कोई प्रोडक्ट लिंक नहीं। प्रोडक्ट पब्लिश करें और Preferences में सर्च इंजन की अनुमति दें।',
      },
      product_data: {
        title: 'प्रोडक्ट पेज के कोड में नाम, दाम और स्टॉक है',
        fix: () =>
          'आपके प्रोडक्ट पेज में प्रोडक्ट का structured data नहीं है। स्टोर का प्रोडक्ट टेम्पलेट लगाएँ, या हमसे कहें।',
      },
      product_variants: {
        title: 'हर वैरिएंट का अपना दाम और स्टॉक कोड में है',
        fix: () => 'वैरिएंट एक ही प्रोडक्ट की तरह लिखे हैं। स्टोर का प्रोडक्ट टेम्पलेट लगाएँ, या हमसे कहें।',
      },
      price_tags: {
        title: 'लिंक प्रीव्यू के लिए दाम के टैग',
        fix: () => 'प्रोडक्ट पेज में दाम के meta टैग नहीं हैं। स्टोर का प्रोडक्ट टेम्पलेट लगाएँ, या हमसे कहें।',
      },
      markdown_copy: {
        title: 'हर प्रोडक्ट की सादी (Markdown) कॉपी',
        fix: () => 'अभी आपकी लाइव साइट पर नहीं है। यह Koomerce के अगले अपडेट के साथ आएगी।',
      },
      product_feed: {
        title: 'प्रोडक्ट फ़ीड (/products.json)',
        fix: () => 'अभी आपकी लाइव साइट पर नहीं है। यह Koomerce के अगले अपडेट के साथ आएगी।',
      },
      mcp_endpoint: {
        title: 'असिस्टेंट आपके स्टोर में लाइव खोज सकते हैं (MCP)',
        fix: () =>
          'आपके स्टोर के MCP ने जवाब नहीं दिया। पासवर्ड पेज चालू होने पर या Preferences में AI crawlers बंद होने पर यह बंद रहता है।',
      },
      products_have_sku: {
        title: 'हर प्रोडक्ट का SKU या बारकोड है',
        fix: (n) =>
          `${n} चालू प्रोडक्ट में ऐसा वैरिएंट है जिसका SKU या बारकोड नहीं। इन्हें जोड़ें ताकि असिस्टेंट और Google सही चीज़ पहचानें।`,
      },
    },
  }),
]
