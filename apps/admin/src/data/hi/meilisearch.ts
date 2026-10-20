import { meilisearchContent } from '@/data/meilisearch'
import { translation } from '@/lib/i18n'

export default [
  translation(meilisearchContent, {
    title: 'Meilisearch',
    subtitle: 'तेज़ स्टोर सर्च जो टाइपो माफ़ कर देता है। ग्राहक “t-shrit” लिखें या “tee”, सही प्रोडक्ट मिलते हैं।',
    save: 'सेव करें',
    discard: 'छोड़ें',
    unsaved: 'बिना सेव किए बदलाव',
    saved: 'सेव हो गया',
    failed: 'सेव नहीं हो पाया। फिर से कोशिश करें।',
    status: {
      live: 'चालू है। आपके स्टोर का सर्च और सर्च बॉक्स के सुझाव Meilisearch से आते हैं।',
      connect: 'अभी जुड़ा नहीं है। नीचे अपना Meilisearch पता और admin key जोड़ें।',
      index: 'जुड़ गया। एक बार Reindex now चलाएँ, पूरा होते ही सर्च Meilisearch पर चला जाएगा।',
      fallback:
        'अगर Meilisearch बंद हो या धीमा चले, तो आपके स्टोर का अपना सर्च जवाब देता है, इसलिए सर्च कभी नहीं रुकता।',
    },
    connect: {
      title: 'Meilisearch जोड़ें',
      description:
        'Meilisearch एक मुफ़्त, ओपन-सोर्स सर्च इंजन है। इसे अपने सर्वर पर चलाएँ या Meilisearch Cloud इस्तेमाल करें।',
      host: {
        label: 'Meilisearch पता',
        help: 'जहाँ आपका Meilisearch जवाब देता है, जैसे https://search.yourstore.in।',
        placeholder: 'https://search.yourstore.in',
      },
      adminKey: {
        label: 'Admin key',
        help: 'master key, या GET /keys से मिली “Default Admin API Key”। एन्क्रिप्ट करके रखी जाती है और दोबारा नहीं दिखती।',
        placeholder: 'Key पेस्ट करें',
        saved: 'एक key सेव है। बदलने के लिए नई key पेस्ट करें।',
        remove: 'Key हटाएँ',
        removed: 'Admin key हटा दी गई',
      },
      test: 'कनेक्शन जाँचें',
      testOk: (version: string) => `Meilisearch ${version} से जुड़ गया`,
      noSearchKey:
        'यह key सर्च-ओनली key नहीं बना सकती, इसलिए सर्च हमारे सर्वर पर admin key से होते हैं। एक बार master key से जोड़कर बनवा लें।',
      searchKey: 'ग्राहकों के सर्च के लिए एक सर्च-ओनली key लगी है।',
    },
    index: {
      title: 'सर्च इंडेक्स',
      description: 'जब आप प्रोडक्ट जोड़ते या बदलते हैं, वे Meilisearch में कॉपी हो जाते हैं।',
      documents: 'सर्च में प्रोडक्ट',
      lastSync: 'आख़िरी अपडेट',
      never: 'कभी नहीं',
      reindex: 'Reindex now',
      reindexing: 'Reindex चल रहा है… यह पेज दोबारा खोलने पर अपडेट होगा।',
      queued: 'Reindex शुरू हो गया',
      indexingNow: 'Meilisearch अभी बदलाव लागू कर रहा है।',
      unknown: 'पता नहीं',
      error: 'आख़िरी समस्या',
      count: (n: string) => `${n} प्रोडक्ट`,
    },
    synonyms: {
      title: 'समानार्थी शब्द',
      description: 'वे शब्द जिनका आपके ग्राहकों के लिए एक ही मतलब है। हर लाइन में एक ग्रुप, शब्द कॉमा से अलग।',
      label: 'समानार्थी ग्रुप',
      placeholder: 'tee, t-shirt, tshirt\nkurta, kurti\nmobile, phone',
      help: (max: number) =>
        `ज़्यादा से ज़्यादा ${max} ग्रुप। ग्रुप के किसी भी शब्द से सर्च करने पर बाकी शब्द भी मिलते हैं।`,
      save: 'समानार्थी शब्द सेव करें',
      saved: 'समानार्थी शब्द सेव हो गए',
    },
    credit: 'Meilisearch ओपन सोर्स है (MIT लाइसेंस), Meili SAS ने बनाया है।',
  }),
]
