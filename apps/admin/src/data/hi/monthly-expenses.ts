import { monthlyExpensesContent } from '@/data/monthly-expenses'
import { translation } from '@/lib/i18n'

export default [
  translation(monthlyExpensesContent, {
    title: 'महीने के खर्च',
    intro:
      'किराया, स्टाफ़, ऐप्स, आपकी वेबसाइट: दुकान चलाने का हर महीने का खर्च। Analytics में शुद्ध मुनाफ़ा इन्हें महीने के ऑर्डर मुनाफ़े से घटाता है।',
    gst: {
      claimable: 'रकम GST से पहले की लिखें: GST आप वापस लेते हैं।',
      notClaimable: 'जो आप असल में देते हैं वह लिखें, GST मिलाकर।',
    },
    thisMonth: 'इस महीने अब तक',
    thisMonthNote: (days, total, full) =>
      `${full} के ${total} में से ${days} दिन। चल रहे महीने में सिर्फ़ बीते दिन गिने जाते हैं।`,
    listTitle: 'आपके खर्च',
    empty: 'अभी कोई खर्च नहीं। किराया, तनख़्वाह या जिन ऐप्स के पैसे देते हैं, वे जोड़ें।',
    add: 'खर्च जोड़ें',
    edit: 'बदलें',
    delete: 'मिटाएँ',
    columns: {
      name: 'खर्च',
      category: 'श्रेणी',
      amount: 'हर महीने',
      months: 'किन महीनों में',
    },
    from: (month) => `${month} से`,
    range: (from, to) => (from === to ? from : `${from} से ${to} तक`),
    categories: {
      staff: 'स्टाफ़ और तनख़्वाह',
      rent: 'किराया और ऑफ़िस',
      software: 'ऐप्स और वेबसाइट',
      marketing: 'मार्केटिंग',
      utilities: 'बिजली, इंटरनेट और फ़ोन',
      services: 'अकाउंटिंग और दूसरी सेवाएँ',
      other: 'अन्य',
    },
    dialog: {
      addTitle: 'महीने का खर्च जोड़ें',
      editTitle: 'यह खर्च बदलें',
      editHelp:
        'वह महीना चुनें जब से बदलाव लागू हो। उससे पहले के महीनों में पुरानी रकम रहेगी, ताकि पिछला मुनाफ़ा कभी न बदले।',
      name: 'नाम',
      namePlaceholder: 'दुकान का किराया',
      category: 'श्रेणी',
      amount: 'हर महीने की रकम (₹)',
      startsOn: 'पहला महीना',
      fromMonth: 'कब से बदलें',
      repeats: 'हर महीने लगता है',
      endsOn: 'आखिरी महीना (ज़रूरी नहीं)',
      endsOnHelp: 'जब तक देते रहें, खाली छोड़ें।',
      save: 'सेव करें',
      add: 'खर्च जोड़ें',
    },
    confirmDelete: {
      title: 'यह खर्च मिटाएँ?',
      body: 'यह हर महीने से हट जाएगा, पिछले महीनों से भी। किसी महीने से बंद करना हो तो इसे बदलें और आखिरी महीना डालें।',
      confirm: 'मिटाएँ',
    },
    saved: 'सेव हो गया',
    deleted: 'मिट गया',
    failed: 'सेव नहीं हो सका',
    invalidAmount: 'रकम रुपये में लिखें, जैसे 25000।',
    invalidName: 'खर्च का नाम लिखें।',
  }),
]
