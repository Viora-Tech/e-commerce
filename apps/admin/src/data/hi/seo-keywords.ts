import { seoKeywordsContent } from '@/data/seo-keywords'
import { translation } from '@/lib/i18n'

export default [
  translation(seoKeywordsContent, {
    heading: 'सर्च कीवर्ड',
    intro:
      'भारत में ग्राहक इस प्रोडक्ट को ढूंढने के लिए Google पर क्या टाइप करते हैं। AI से लिखते समय सर्च टाइटल और डिस्क्रिप्शन इन्हीं पर बनते हैं। ये आपके स्टोर पर कभी नहीं दिखते।',
    suggest: 'कीवर्ड सुझाएं',
    suggestAgain: 'फिर से सुझाएं',
    suggesting: 'कीवर्ड सोचे जा रहे हैं…',
    needTitle: 'पहले प्रोडक्ट का नाम डालें।',
    failed: 'कीवर्ड नहीं सुझा पाए। फिर से कोशिश करें।',
    empty: 'अभी कोई कीवर्ड नहीं। अपने जोड़ें, या AI से सुझाव लें।',
    emptyNoAi: 'अभी कोई कीवर्ड नहीं। वो शब्द जोड़ें जिनसे ग्राहक सर्च करेंगे।',
    primary: 'मुख्य',
    primaryHint: 'सर्च टाइटल मुख्य कीवर्ड पर बनता है।',
    makePrimary: 'मुख्य बनाएं',
    remove: (keyword: string) => `${keyword} हटाएं`,
    addLabel: 'अपना जोड़ें',
    addPlaceholder: 'जैसे wireless mouse for laptop',
    add: 'जोड़ें',
    full: (max: number) => `ज़्यादा से ज़्यादा ${max} कीवर्ड। नया जोड़ने के लिए एक हटाएं।`,
    suggestions: {
      heading: 'सुझाए गए कीवर्ड',
      hint: 'जो सही लगें उन्हें टिक करें। स्टार वाला AI का चुना मुख्य कीवर्ड है।',
      fromSearch: (n: number) => `${n} असली Google सर्च पर आधारित, जिनसे लोग इस प्रोडक्ट तक पहुंचे।`,
      seen: 'पहले सर्च हुआ',
      intents: { buy: 'खरीदना', compare: 'तुलना', info: 'जानकारी' },
      use: (n: number) => `${n} कीवर्ड इस्तेमाल करें`,
      dismiss: 'हटाएं',
      added: 'कीवर्ड जुड़ गए। रखने के लिए प्रोडक्ट सेव करें।',
    },
    writer: {
      using: (keyword: string) => `आपका मुख्य कीवर्ड “${keyword}” इस्तेमाल हुआ`,
      missing: (keyword: string) => `आपका मुख्य कीवर्ड “${keyword}” इस्तेमाल नहीं हुआ`,
      steering: (keyword: string) => `सर्च टाइटल और डिस्क्रिप्शन “${keyword}” पर लिखे जाएंगे।`,
      none: 'सुझाव: SEO टैब पर सर्च कीवर्ड चुनें, फिर सर्च टाइटल और डिस्क्रिप्शन उन्हीं पर लिखे जाएंगे।',
    },
  }),
]
