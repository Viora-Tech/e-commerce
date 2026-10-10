import { articleFormContent, blogListContent, blogsManageContent } from '@/data/blog'
import { translation } from '@/lib/i18n'

/** Hindi for Blog posts. */
export default [
  translation(blogListContent, {
    heading: 'ब्लॉग पोस्ट',
    add: 'पोस्ट लिखें',
    summary: (all, live, scheduled, drafts) => {
      if (all === 0) return 'आपके ग्राहकों के लिए कहानियां, लॉन्च और गाइड।'
      const parts = [`${all} पोस्ट`]
      if (live > 0) parts.push(`${live} चालू`)
      if (scheduled > 0) parts.push(`${scheduled} तय समय पर`)
      if (drafts > 0) parts.push(`${drafts} ड्राफ़्ट`)
      return parts.join(' · ')
    },
    manageBlogs: 'ब्लॉग संभालें',
    resource: { singular: 'ब्लॉग पोस्ट', plural: 'ब्लॉग पोस्ट' },
    none: 'कोई नहीं',
    columns: {
      title: 'पोस्ट',
      blog: 'ब्लॉग',
      status: 'स्टेटस',
      author: 'लेखक',
      published: 'कब छपा',
    },
    tabs: { all: 'सभी', published: 'चालू', scheduled: 'तय समय पर', draft: 'ड्राफ़्ट' },
    status: { published: 'चालू', scheduled: 'तय समय पर', draft: 'ड्राफ़्ट' },
    scheduledFor: (when) => `${when} को चालू होगा`,
    filters: { blog: 'ब्लॉग', tag: 'टैग', any: 'कोई भी', clear: 'फ़िल्टर हटाएं' },
    bulk: {
      publish: 'चालू करें',
      unpublish: 'ड्राफ़्ट में भेजें',
      delete: 'हटाएं',
      published: (n) => `${n} पोस्ट चालू हो गईं`,
      unpublished: (n) => `${n} पोस्ट ड्राफ़्ट में चली गईं`,
      deleted: (n) => `${n} पोस्ट हट गईं`,
      failed: 'यह नहीं हो पाया। फिर कोशिश करें',
      confirmDelete: {
        title: (n) => `${n} पोस्ट हटाएं?`,
        body: 'हटाई गई पोस्ट स्टोर से हट जाती हैं और वापस नहीं आ सकतीं।',
        cancel: 'रद्द करें',
        confirm: 'हटाएं',
      },
    },
    empty: {
      heading: 'अपनी पहली ब्लॉग पोस्ट लिखें',
      body: 'पोस्ट आपके स्टोर के ब्लॉग पर छपती हैं और सर्च में ग्राहकों तक पहुंचने में मदद करती हैं।',
    },
  }),

  translation(articleFormContent, {
    newTitle: 'ब्लॉग पोस्ट जोड़ें',
    editTitle: 'ब्लॉग पोस्ट बदलें',
    back: 'ब्लॉग पोस्ट',
    save: 'सेव करें',
    saving: 'सेव हो रहा है…',
    discard: 'रद्द करें',
    unsaved: 'पोस्ट सेव नहीं हुई',
    created: 'ब्लॉग पोस्ट बन गई',
    saved: 'ब्लॉग पोस्ट सेव हो गई',
    deletedToast: 'ब्लॉग पोस्ट हट गई',
    saveFailed: 'ब्लॉग पोस्ट सेव नहीं हो पाई',
    titleRequired: 'पोस्ट का नाम लिखें',
    viewLive: 'स्टोर पर देखें',
    main: {
      title: 'नाम',
      titlePlaceholder: 'जैसे: हमारे नए प्रोडक्ट या ऑफ़र के बारे में',
      content: 'कंटेंट',
      excerpt: 'छोटा सार',
      excerptHelp: 'ब्लॉग पेज और सर्च में दिखता है। खाली छोड़ें तो पोस्ट की शुरुआत दिखेगी।',
    },
    visibility: {
      heading: 'दिखना',
      published: 'चालू',
      scheduled: 'तय समय पर',
      draft: 'छिपी',
      publishedHelp: (when) => (when ? `${when} को छपी` : 'सेव करते ही चालू होगी'),
      scheduledHelp: 'पोस्ट इसी समय स्टोर पर चालू हो जाएगी।',
      draftHelp: 'छिपी पोस्ट सिर्फ़ स्टाफ़ देख सकता है।',
      when: 'छपने की तारीख',
      tz: 'समय आपके ब्राउज़र के टाइम ज़ोन में है।',
    },
    image: {
      heading: 'फ़ोटो',
      pick: 'फ़ोटो जोड़ें',
      change: 'बदलें',
      remove: 'हटाएं',
      alt: 'फ़ोटो का वर्णन',
      altHelp: 'स्क्रीन रीडर और सर्च इंजन के लिए फ़ोटो का वर्णन लिखें।',
      empty: 'पहले कंटेंट > फ़ाइलें में फ़ोटो अपलोड करें।',
    },
    organisation: {
      heading: 'व्यवस्था',
      blog: 'ब्लॉग',
      createBlog: 'ब्लॉग बनाएं',
      author: 'लेखक',
      tags: 'टैग',
      tagsPlaceholder: 'टैग खोजें या बनाएं',
    },
    seo: {
      heading: 'सर्च इंजन में दिखना',
      edit: 'बदलें',
      previewHint: 'टाइटल और कंटेंट लिखें, तब दिखेगा कि सर्च में यह पोस्ट कैसी लगेगी।',
      title: 'पेज का टाइटल',
      titleHelp: (n) => `70 में से ${n} अक्षर इस्तेमाल हुए`,
      description: 'छोटा विवरण',
      descriptionHelp: (n) => `320 में से ${n} अक्षर इस्तेमाल हुए`,
      handle: 'पता (URL)',
    },
    delete: {
      action: 'पोस्ट हटाएं',
      heading: 'यह ब्लॉग पोस्ट हटाएं?',
      body: 'यह स्टोर से हट जाएगी और वापस नहीं आएगी।',
      cancel: 'रद्द करें',
      confirm: 'हटाएं',
    },
  }),

  translation(blogsManageContent, {
    heading: 'ब्लॉग संभालें',
    back: 'ब्लॉग पोस्ट',
    add: 'ब्लॉग बनाएं',
    posts: (n) => `${n} पोस्ट`,
    edit: 'बदलें',
    delete: 'हटाएं',
    commentPolicy: {
      disabled: 'कमेंट बंद हैं',
      moderated: 'कमेंट आ सकते हैं, पहले आपकी मंज़ूरी चाहिए',
      open: 'कमेंट आ सकते हैं, सीधे दिखेंगे',
    },
    dialog: {
      createTitle: 'ब्लॉग बनाएं',
      editTitle: 'ब्लॉग बदलें',
      title: 'नाम',
      titlePlaceholder: 'जैसे: ख़बरें, गाइड',
      handle: 'पता (URL)',
      handleHelp: 'खाली छोड़ें तो नाम से बन जाएगा।',
      comments: 'कमेंट',
      template: 'थीम टेम्पलेट',
      cancel: 'रद्द करें',
      save: 'सेव करें',
      saving: 'सेव हो रहा है…',
    },
    created: 'ब्लॉग बन गया',
    saved: 'ब्लॉग सेव हो गया',
    deleted: 'ब्लॉग हट गया',
    failed: 'ब्लॉग सेव नहीं हो पाया',
    confirmDelete: {
      title: (name) => `${name} हटाएं?`,
      body: 'सिर्फ़ वही ब्लॉग हटता है जिसमें कोई पोस्ट न हो।',
      hasPosts: (n) => `इस ब्लॉग में ${n} पोस्ट हैं। ब्लॉग हटाने से पहले उन्हें दूसरे ब्लॉग में भेजें या हटाएं।`,
      cancel: 'रद्द करें',
      confirm: 'हटाएं',
    },
  }),
]
