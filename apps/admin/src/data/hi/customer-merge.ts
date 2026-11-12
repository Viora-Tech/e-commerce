import {
  customerEmailContent,
  customerMergeContent,
  customerPickerContent,
  orderCustomerContent,
} from '@/data/customer-merge'
import { translation } from '@/lib/i18n'

export default [
  translation(customerPickerContent, {
    label: 'ग्राहक खोजें',
    placeholder: 'नाम, ईमेल या मोबाइल नंबर',
    searching: 'खोज रहे हैं…',
    none: 'कोई ग्राहक नहीं मिला।',
    hint: 'कम से कम 2 अक्षर लिखें।',
    unnamed: 'नाम नहीं',
    orders: (n: number) => `${n} ऑर्डर`,
  }),
  translation(customerMergeContent, {
    menu: 'दूसरे ग्राहक के साथ मिलाएँ…',
    title: 'दूसरे ग्राहक के साथ मिलाएँ',
    pickBody:
      'उसी व्यक्ति का दूसरा रिकॉर्ड चुनें। उसमें जो कुछ है, वह इस ग्राहक पर आ जाएगा और दूसरा रिकॉर्ड बंद हो जाएगा।',
    reviewBody: (other: string) =>
      `${other} में जो कुछ है, वह एक साथ इस ग्राहक पर आ जाएगा। फिर दूसरा रिकॉर्ड बंद होगा और उसके साइन-इन खत्म हो जाएँगे।`,
    moves: 'यहाँ क्या आएगा',
    orders: (n: number) => `${n} ऑर्डर`,
    addresses: (n: number) => `${n} सेव किए पते`,
    storeCredit: (amount: string) => `${amount} स्टोर क्रेडिट (इस बैलेंस में जुड़ेगा)`,
    giftCards: (n: number) => `${n} गिफ़्ट कार्ड`,
    signIns: (n: number) => `${n} साइन-इन (Google, Apple…)`,
    carts: (n: number) => `${n} कार्ट`,
    notes: (n: number) => `${n} टाइमलाइन नोट`,
    reviews: (n: number) => `${n} रिव्यू और सवाल`,
    conversations: (n: number) => `${n} इनबॉक्स बातचीत`,
    alsoMoves: 'टैग, नोट, मार्केटिंग सहमति का इतिहास और ब्राउज़िंग इतिहास भी साथ आएँगे।',
    nothing: 'दूसरे रिकॉर्ड से और कुछ जुड़ा नहीं है।',
    keepHeading: 'ये जानकारी रखें',
    email: 'ईमेल',
    phone: 'फ़ोन',
    name: 'नाम',
    thisOne: 'यह ग्राहक',
    otherOne: 'दूसरा रिकॉर्ड',
    none: 'कुछ नहीं',
    emailHint:
      'ग्राहक उसी ईमेल से साइन इन करेगा जो आप रखेंगे। उनका Google या Apple साइन-इन दोनों हालात में आ जाएगा।',
    cancel: 'रद्द करें',
    confirm: 'ग्राहक मिलाएँ',
    done: 'ग्राहक मिल गए',
    failed: 'ग्राहक नहीं मिल पाए',
  }),
  translation(orderCustomerContent, {
    change: 'ग्राहक बदलें',
    changeHint: 'यह ऑर्डर किसी दूसरे मौजूदा ग्राहक पर ले जाएँ',
    title: 'ग्राहक बदलें',
    body: 'ऑर्डर आपके चुने ग्राहक पर चला जाएगा और उनके अकाउंट में दिखेगा। उसका अपना ईमेल, फ़ोन और पता वैसा ही रहेगा।',
    current: (name: string) => `अभी: ${name}`,
    guest: 'अभी: गेस्ट चेकआउट',
    confirm: 'ऑर्डर ले जाएँ',
    cancel: 'रद्द करें',
    done: 'ऑर्डर ले जाया गया',
    failed: 'ऑर्डर नहीं ले जा पाए',
    emailOwner: (name: string) => `यह ईमेल ${name} का है। क्या यह ऑर्डर भी उन पर ले जाएँ?`,
    emailOwnerHint: 'तब ऑर्डर उनके अकाउंट में दिखेगा। दोनों ग्राहक मिलाए नहीं जाएँगे।',
    importedTax: 'इम्पोर्ट किया ऑर्डर अपना GSTIN और कंपनी का नाम वैसा ही रखता है।',
  }),
  translation(customerEmailContent, {
    help: 'ग्राहक इसी ईमेल से साइन इन करता है। उनके ऑर्डर उसी ईमेल के साथ रहते हैं जिससे वे दिए गए थे।',
    taken:
      'यह ईमेल किसी दूसरे ग्राहक का है। दोनों को एक ग्राहक बनाने के लिए और विकल्प › दूसरे ग्राहक के साथ मिलाएँ चुनें।',
    openOther: 'वह ग्राहक खोलें',
    discardBody: 'आपने जो नाम, ईमेल और फ़ोन बदले हैं, वे अभी सेव नहीं हुए हैं।',
  }),
]
