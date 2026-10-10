import { bulkEditContent } from '@/data/bulk-edit'
import { translation } from '@/lib/i18n'

export default [
  translation(bulkEditContent, {
    title: 'एक साथ बदलें',
    back: 'प्रोडक्ट',
    summary: (products, variants) => `${products} प्रोडक्ट · ${variants} वेरिएंट`,
    hint: 'सेल पर क्लिक करके लिखें। स्प्रेडशीट से पेस्ट करें, कोना खींचकर नीचे तक भरें, या ऊपर वाला सेल कॉपी करने के लिए Ctrl+D दबाएं।',
    truncated: (max) => `सिर्फ़ पहले ${max} वेरिएंट दिख रहे हैं। बाकी बदलने के लिए कम प्रोडक्ट चुनें।`,
    save: 'सेव करें',
    saving: 'सेव हो रहा है',
    discard: 'रद्द करें',
    unsaved: (n) => `${n} सेल बदले`,
    noChanges: 'अभी कुछ नहीं बदला',
    columns: {
      title: 'नाम',
      status: 'स्टेटस',
      vendor: 'विक्रेता',
      productType: 'प्रकार',
      tags: 'टैग',
      variantTitle: 'वेरिएंट',
      price: 'कीमत',
      mrp: 'पहले की कीमत',
      cost: 'लागत',
      sku: 'SKU',
      barcode: 'बारकोड',
      weight: 'वज़न (ग्राम)',
      hsCode: 'HSN',
      gst: 'GST %',
      stock: (location) => `स्टॉक · ${location}`,
    },
    statuses: { draft: 'ड्राफ़्ट', active: 'चालू', archived: 'आर्काइव' },
    errors: {
      heading: (n) => `सेव करने से पहले ${n} सेल ठीक करने हैं`,
      saveFailed: 'बदलाव सेव नहीं हुए',
      rowLabel: (product, variant, column, message) =>
        `${product}${variant ? ` · ${variant}` : ''} · ${column}: ${message}`,
      more: (n) => `और ${n}`,
    },
    toasts: {
      saved: (products, variants, stock) => {
        const parts = [
          products > 0 ? `${products} प्रोडक्ट` : null,
          variants > 0 ? `${variants} वेरिएंट` : null,
          stock > 0 ? `${stock} स्टॉक गिनती` : null,
        ].filter(Boolean)
        return `सेव हुआ: ${parts.join(', ')}`
      },
      undo: 'वापस करें',
      undone: 'बदलाव वापस हो गए',
      undoFailed: 'वापस नहीं हो सका; शीट तब से बदल चुकी है',
    },
    empty: {
      heading: 'बदलने के लिए कुछ नहीं',
      body: 'प्रोडक्ट पेज पर प्रोडक्ट चुनें, फिर एक साथ बदलें दबाएं।',
      action: 'प्रोडक्ट पर वापस',
    },
  }),
]
