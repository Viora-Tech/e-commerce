import { seoAssistantContent } from '@/data/seo-assistant'
import { translation } from '@/lib/i18n'

export default [
  translation(seoAssistantContent, {
    title: 'SEO',
    subtitle:
      'Google पर आपके प्रोडक्ट, कलेक्शन और पेज: लोग क्या खोजते हैं, आप किस जगह दिखते हैं, और पहले क्या दोबारा लिखें।',
    loadFailed: 'सर्च के मौक़े लोड नहीं हो सके',
    tabs: { report: 'रिपोर्ट', assistant: 'सर्च के मौक़े' },
    states: {
      notInstalledTitle: 'Google Search Console जोड़ें',
      notInstalled:
        'सर्च के मौक़े आपके असली Google नंबर पढ़ते हैं। मुफ़्त Google Search Console ऐप इंस्टॉल करें और अपना Google अकाउंट जोड़ें।',
      install: 'ऐप इंस्टॉल करें',
      notConnectedTitle: 'Google Search Console जोड़ना पूरा करें',
      notConnected: 'Google से साइन इन करें और ऐप की सेटिंग में अपने स्टोर की प्रॉपर्टी चुनें।',
      openSettings: 'Search Console सेटिंग खोलें',
      noDataTitle: 'अभी Google के नंबर नहीं हैं',
      noData:
        'Google ने अभी आपके स्टोर की कोई सर्च नहीं बताई। नई प्रॉपर्टी में कुछ दिन लग सकते हैं। नंबर दिन में एक बार अपडेट होते हैं।',
    },
    list: {
      heading: 'सुधारने लायक पेज',
      body: 'सबसे बड़ा मौक़ा पहले: वे पेज जिन्हें Google अक्सर 4 से 15 की जगह पर दिखाता है, जहाँ बेहतर सर्च टाइटल और डिस्क्रिप्शन सबसे ज़्यादा क्लिक लाते हैं।',
      synced: (when) => `Google के नंबर ${when} के। ये दिन में एक बार अपडेट होते हैं।`,
      filters: { all: 'सभी', band: 'जगह 4–15', gaps: 'कमियों वाले' },
      resource: { product: 'प्रोडक्ट', collection: 'कलेक्शन', page: 'पेज' },
      impressions: 'व्यू',
      clicks: 'क्लिक',
      position: 'जगह',
      topSearches: 'टॉप सर्च',
      noSearches: 'अभी कोई एक सर्च अलग से नहीं दिखती।',
      current: 'अभी Google पर',
      noSeoTitle: 'सर्च टाइटल नहीं: Google आइटम का अपना टाइटल दिखाता है।',
      noSeoDescription: 'सर्च डिस्क्रिप्शन नहीं: Google पेज से टेक्स्ट चुनता है।',
      gaps: 'कमियाँ',
      noGaps: 'कोई कमी नहीं मिली।',
      moreGaps: (n) => `+${n} और`,
      fix: 'AI से ठीक करें',
      fixSelected: (n) => `${n} को AI से ठीक करें`,
      select: (title) => `${title} चुनें`,
      selectMax: (n) => `एक बार में ${n} तक।`,
      edit: 'बदलें',
      empty: 'इस फ़िल्टर में कुछ नहीं है।',
      more: (n) => `${n} और दिखाएँ`,
      aiOff: 'इन्हें AI से ठीक करने के लिए सेटिंग → AI में Write with AI चालू करें।',
    },
    fix: {
      title: (n) => (n === 1 ? 'AI से ठीक करें' : `${n} आइटम AI से ठीक करें`),
      description:
        'लोगों की असली सर्च पर बने नए सर्च टाइटल और डिस्क्रिप्शन। Apply दबाने तक कुछ सेव नहीं होता।',
      working: 'लिख रहे हैं…',
      failed: 'AI इस बार इन्हें नहीं लिख सका। फिर से कोशिश करें।',
      itemFailed: 'यह नहीं लिखा जा सका। इसे अकेले फिर से आज़माएँ।',
      notFound: 'यह आइटम अब लाइव नहीं है।',
      before: 'अभी',
      after: 'सुझाव',
      seoTitle: 'सर्च टाइटल',
      seoDescription: 'सर्च डिस्क्रिप्शन',
      chars: (n, max) => `${n} / ${max} अक्षर`,
      empty: '(कुछ नहीं)',
      snippet: 'पेज में जोड़ने के लिए परिचय या FAQ',
      snippetHint: (words) =>
        `${words} शब्द। Apply इसे सेव नहीं करता: पसंद आए तो डिस्क्रिप्शन या पेज के टेक्स्ट में कॉपी करें।`,
      copy: 'कॉपी करें',
      copied: 'कॉपी हो गया',
      include: 'इसे लागू करें',
      fromSearches: (n) =>
        n === 0 ? 'सर्च डेटा नहीं: आइटम के अपने टेक्स्ट से लिखा।' : `${n} असली सर्च पर बना।`,
      apply: (n) => (n === 1 ? 'लागू करें' : `${n} लागू करें`),
      applied: (n) => (n === 1 ? 'सर्च लिस्टिंग अपडेट हुई' : `${n} सर्च लिस्टिंग अपडेट हुईं`),
      applyFailed: 'बदलाव सेव नहीं हो सके। फिर से कोशिश करें।',
    },
  }),
]
