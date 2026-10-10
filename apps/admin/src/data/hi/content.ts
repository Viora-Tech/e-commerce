import { contentContent, pagesListContent } from '@/data/content'
import { onlineStoreContent } from '@/data/online-store'
import { translation } from '@/lib/i18n'

/** Hindi for the Content hub and Pages. */
export default [
  translation(contentContent, {
    title: 'कंटेंट',
    summary: 'आपके स्टोर पर इस्तेमाल होने वाली फ़ाइलें, मेन्यू और बना-बनाया कंटेंट।',
    goToPages: 'पेज पर जाएं',
    cards: {
      files: {
        title: 'फ़ाइलें',
        body: 'पेज और प्रोडक्ट पर लगने वाली फ़ोटो, वीडियो और दस्तावेज़।',
        open: 'फ़ाइलें खोलें',
        count: (n) => `${n} फ़ाइल`,
        none: 'अभी कोई फ़ाइल नहीं',
      },
      contentTypes: {
        title: 'कंटेंट टाइप',
        body: 'अपने फ़ील्ड वाला कंटेंट, जो आपकी थीम में कहीं भी दिख सकता है।',
        open: 'कंटेंट टाइप खोलें',
        count: (n, names) => `${n} टाइप: ${names}`,
        none: 'अभी कोई कंटेंट टाइप नहीं',
      },
      menus: {
        title: 'मेन्यू',
        body: 'वे लिंक जिनसे ग्राहक आपके स्टोर में घूमते हैं।',
        open: 'मेन्यू खोलें',
        count: (n, names) => `${n} मेन्यू: ${names}`,
        none: 'अभी कोई मेन्यू नहीं',
      },
      blogPosts: {
        title: 'ब्लॉग पोस्ट',
        body: 'कहानियां, लॉन्च और गाइड जो लोगों को आपकी दुकान तक लाते हैं।',
        open: 'ब्लॉग पोस्ट खोलें',
        count: (posts, drafts) =>
          drafts > 0 ? `${posts} पोस्ट · ${drafts} ड्राफ़्ट` : `${posts} पोस्ट`,
        none: 'अभी कोई पोस्ट नहीं',
      },
    },
  }),

  translation(pagesListContent, {
    title: 'पेज',
    summary: (total, live, hidden) => {
      if (total === 0) return 'हमारे बारे में, संपर्क और FAQ जैसे पेज।'
      const parts = [`${total} पेज`]
      if (live > 0) parts.push(`${live} स्टोर पर चालू`)
      if (hidden > 0) parts.push(`${hidden} छिपे`)
      return parts.join(' · ')
    },
    add: 'पेज जोड़ें',
    open: 'पेज खोलें',
    search: 'पेज खोजें',
    resource: { singular: 'पेज', plural: 'पेज' },
    tabs: { all: 'सभी', live: 'चालू', hidden: 'छिपे' },
    columns: { title: 'नाम', template: 'टेम्पलेट', visibility: 'दिखना', updated: 'बदलाव' },
    template: { default: 'आम पेज' },
    visibility: { live: 'चालू', hidden: 'छिपा' },
    empty: {
      heading: 'अभी कोई पेज नहीं',
      body: 'एडिटर से बनाना शुरू करने के लिए एक पेज जोड़ें।',
    },
    noMatch: { heading: 'कोई पेज नहीं मिला', body: 'दूसरा शब्द या दूसरा टैब आज़माएं।' },
  }),

  translation(onlineStoreContent, {
    pages: {
      title: 'पेज',
      add: 'पेज जोड़ें',
      search: 'पेज खोजें',
      columns: { title: 'नाम', url: 'पता', status: 'स्टेटस', updated: 'बदलाव' },
      status: { published: 'चालू', draft: 'ड्राफ़्ट' },
      empty: {
        heading: 'अभी कोई पेज नहीं',
        body: 'एडिटर से बनाना शुरू करने के लिए एक पेज जोड़ें।',
      },
      create: {
        title: 'पेज जोड़ें',
        titleLabel: 'नाम',
        handleLabel: 'पता (URL)',
        handlePrefix: '/pages/',
        handleHelp: 'खाली छोड़ें तो नाम से बन जाएगा। होम पेज के लिए "home" लिखें।',
        cancel: 'रद्द करें',
        confirm: 'बनाएं',
        failed: 'पेज नहीं बन पाया',
      },
    },
    form: {
      back: 'पेज',
      title: 'नाम',
      content: 'कंटेंट',
      unsaved: 'बदलाव सेव नहीं हुए',
      save: 'सेव करें',
      saving: 'सेव हो रहा है',
      discard: 'रद्द करें',
      saved: 'पेज सेव हो गया',
      failed: 'पेज सेव नहीं हो पाया',
      viewLive: 'स्टोर पर देखें',
      seo: {
        heading: 'सर्च इंजन में दिखना',
        handle: 'पता (URL)',
        seoTitle: 'पेज का टाइटल',
        seoDescription: 'छोटा विवरण',
        help: 'खाली छोड़ें तो पेज का नाम और कंटेंट इस्तेमाल होगा।',
      },
      visibility: {
        heading: 'दिखना',
        visible: 'चालू',
        hidden: 'छिपा',
        visibleHelp: 'ग्राहक यह पेज खोल सकते हैं।',
        hiddenHelp: 'सिर्फ़ कस्टमाइज़ में इसका प्रीव्यू दिखेगा।',
      },
      template: {
        heading: 'थीम टेम्पलेट',
        default: 'आम पेज',
        help: 'लाइव थीम इसी टेम्पलेट से पेज सजाती है।',
        editContent: 'कंटेंट बदलें',
        editHelp: 'सेक्शन सजाने के लिए टेम्पलेट कस्टमाइज़ में खुलेगा।',
      },
    },
  }),
]
