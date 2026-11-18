import { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import { translation } from '@/lib/i18n'

export default [
  translation(gstAlreadyInvoicedContent, {
    action: 'पहले से इनवॉइस हुआ',
    actionLabel: (order) => `${order} का इनवॉइस पहले ही बन चुका है`,
    title: (order) => `${order} का इनवॉइस पहले ही बन चुका है`,
    body: 'जो इनवॉइस आपने पहले हाथ से या अपने पुराने बिलिंग सिस्टम में बनाया था, उसे यहाँ दर्ज करें। यह GSTR-1 और GSTR-3B में किसी भी इनवॉइस की तरह गिना जाता है, और कोई PDF न बनती है न ईमेल होती है।',
    number: 'इनवॉइस नंबर',
    numberHelp:
      'ठीक वैसा ही जैसा उस इनवॉइस पर छपा है। अधिकतम 16 अक्षर, अंक, / और -। इस वित्त वर्ष में पहले से इस्तेमाल हुआ नंबर स्वीकार नहीं होगा।',
    date: 'इनवॉइस की तारीख़',
    dateHelp: 'उस इनवॉइस पर लिखी तारीख़। इसी से GST रिटर्न का महीना तय होता है।',
    submit: 'इनवॉइस दर्ज करें',
    recorded: (number) => `${number} दर्ज हुआ`,
    failed: 'यह इनवॉइस दर्ज नहीं हो सका',
    outside: 'दर्ज किया गया, इनवॉइस Koomerce के बाहर बना',
    outsideBody:
      'यह इनवॉइस Koomerce के बाहर बना था, इसलिए यहाँ इसकी PDF नहीं है। यह आपके GST रिटर्न में गिना जाता है।',
  }),
]
