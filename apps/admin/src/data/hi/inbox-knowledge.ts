import { inboxKnowledgeContent } from '@/data/inbox-knowledge'
import { translation } from '@/lib/i18n'

export default [
  translation(inboxKnowledgeContent, {
    failed: 'कुछ गड़बड़ हो गई। फिर कोशिश करें।',
    title: 'नॉलेज बेस',
    subtitle:
      'छोटे जवाब जो AI एजेंट ख़रीदारों को देता है: शिपिंग का समय, वारंटी, रिटर्न, COD। सिर्फ़ पब्लिश किए गए जवाब इस्तेमाल होते हैं।',
    publishedOf: (published, total) => `${total} में से ${published} पब्लिश`,
    add: 'जवाब जोड़ें',
    edit: 'बदलें',
    delete: 'मिटाएँ',
    moveUp: 'ऊपर करें',
    moveDown: 'नीचे करें',
    listTitle: 'आपके जवाब',
    empty: 'अभी कोई जवाब नहीं। वे सवाल जोड़ें जो ख़रीदार रोज़ पूछते हैं, ताकि AI वैसे ही जवाब दे जैसे आप देते।',
    columns: { title: 'सवाल', answer: 'जवाब', published: 'पब्लिश' },
    publish: (title) => `"${title}" पब्लिश करें`,
    imported: 'Shopify से',
    saved: 'जवाब सहेजा गया',
    deleted: 'जवाब मिटाया गया',
    publishedOn: 'पब्लिश हो गया। AI अब इसे इस्तेमाल कर सकता है।',
    publishedOff: 'पब्लिश हटाया। AI अब इसे इस्तेमाल नहीं करता।',
    aiOff: 'AI एजेंट बंद है, इसलिए ख़रीदारों को ये जवाब अभी नहीं मिलते।',
    aiSettings: 'AI एजेंट चालू करें',
    bringOver: {
      title: 'Shopify से Knowledge Base Facts',
      body: (remaining, total) =>
        remaining === total
          ? `आपके Shopify इम्पोर्ट में ${total} Knowledge Base Facts आए। इन्हें यहाँ कॉपी करें ताकि AI इन्हें इस्तेमाल कर सके।`
          : `इम्पोर्ट किए गए ${total} Knowledge Base Facts में से ${remaining} अभी यहाँ नहीं हैं।`,
      note: 'जो जवाब आपने Shopify में पक्के किए थे, उनकी पब्लिश सेटिंग वैसी ही रहती है। जो जवाब Shopify ने सिर्फ़ सुझाए थे, वे बिना पब्लिश के आते हैं ताकि आप जाँच लें।',
      action: 'यहाँ लाएँ',
      done: (added) => (added === 0 ? 'लाने को कुछ नया नहीं' : `${added} जवाब लाए गए`),
    },
    dialog: {
      addTitle: 'जवाब जोड़ें',
      editTitle: 'जवाब बदलें',
      title: 'सवाल या विषय',
      titlePlaceholder: 'शिपिंग में कितना समय लगता है?',
      answer: 'जवाब',
      answerPlaceholder: 'ऑर्डर 1 से 2 दिन में भेजे जाते हैं और ज़्यादातर शहरों में 3 से 5 दिन में पहुँचते हैं।',
      answerHelp: 'वैसे लिखें जैसे आप ख़रीदार को बताते। AI इसे जैसा है वैसा बताता है, अपनी ओर से कुछ नहीं जोड़ता।',
      published: 'पब्लिश',
      publishedHelp: 'AI सिर्फ़ पब्लिश किए गए जवाब इस्तेमाल करता है।',
      add: 'जोड़ें',
      save: 'सहेजें',
      invalid: 'सवाल और जवाब दोनों भरें।',
    },
    confirmDelete: {
      title: 'यह जवाब मिटाएँ?',
      body: 'AI इसे तुरंत इस्तेमाल करना बंद कर देता है।',
      confirm: 'मिटाएँ',
    },
    takeOver: {
      title: 'इस चैट में AI एजेंट जवाब दे रहा है',
      hint: 'ख़ुद जवाब देने के लिए चैट अपने हाथ में लें। जवाब भेजने से भी चैट आपके हाथ में आ जाती है।',
      action: 'अपने हाथ में लें',
      done: 'चैट अब आपके हाथ में है। इस चैट में AI चुप रहेगा।',
    },
  }),
]
