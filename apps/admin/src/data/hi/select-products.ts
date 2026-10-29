import { selectProductsContent } from '@/data/select-products'
import { translation } from '@/lib/i18n'

export default [
  translation(selectProductsContent, {
    title: 'प्रोडक्ट चुनें',
    noPrice: 'अभी कीमत नहीं',
    search: 'प्रोडक्ट खोजें',
    searchLabel: 'नाम या SKU से प्रोडक्ट खोजें',
    collection: 'कलेक्शन',
    productType: 'प्रोडक्ट का प्रकार',
    status: 'स्थिति',
    anyCollection: 'सभी कलेक्शन',
    anyType: 'सभी प्रकार',
    anyStatus: 'कोई भी स्थिति',
    statuses: { active: 'चालू', draft: 'ड्राफ़्ट' },
    showSelectedOnly: 'सिर्फ़ चुने हुए दिखाएँ',
    empty: 'कोई प्रोडक्ट नहीं मिला',
    emptySelected: 'अभी कुछ नहीं चुना',
    failed: 'प्रोडक्ट लोड नहीं हो सके',
    retry: 'फिर कोशिश करें',
    inStock: (n: number) => `${n} स्टॉक में`,
    outOfStock: 'स्टॉक खत्म',
    variantCount: (n: number) => `${n} वेरिएंट`,
    alreadyAdded: 'पहले से जोड़ा गया',
    expand: 'वेरिएंट दिखाएँ',
    collapse: 'वेरिएंट छिपाएँ',
    summary: (products: number, variants: number) => `${products} प्रोडक्ट · ${variants} वेरिएंट चुने गए`,
    productsOnly: (products: number) => `${products} प्रोडक्ट चुने गए`,
    cancel: 'रद्द करें',
    add: (n: number) => (n === 0 ? 'प्रोडक्ट जोड़ें' : `${n} प्रोडक्ट जोड़ें`),
  }),
]
