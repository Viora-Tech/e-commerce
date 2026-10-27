import { customerAddressesContent } from '@/data/customer-addresses'
import { translation } from '@/lib/i18n'

export default [
  translation(customerAddressesContent, {
    heading: 'पते',
    add: 'पता जोड़ें',
    edit: 'बदलें',
    remove: 'हटाएँ',
    shipping: {
      heading: 'शिपिंग पता',
      add: 'शिपिंग पता जोड़ें',
      empty: 'अभी कोई शिपिंग पता नहीं है।',
      use: 'यहाँ भेजें',
      saved: 'शिपिंग पता बदल गया',
    },
    billing: {
      heading: 'बिलिंग पता',
      add: 'बिलिंग पता जोड़ें',
      sameAsShipping: 'शिपिंग पते जैसा ही',
      useShipping: 'शिपिंग पता इस्तेमाल करें',
      use: 'यहाँ बिल करें',
      saved: 'बिलिंग पता बदल गया',
    },
    others: 'बाकी सेव पते',
    defaultFailed: 'पता नहीं बदल पाया',
    gstinLabel: 'GSTIN',
    fromOrder: 'उनके पिछले ऑर्डर से',
    dialog: {
      addTitle: 'पता जोड़ें',
      editTitle: 'पता बदलें',
      role: {
        label: 'यह पता किसके लिए है',
        options: { shipping: 'शिपिंग', billing: 'बिलिंग', both: 'दोनों' },
        help: {
          shipping: 'नए ऑर्डर यहाँ भेजे जाएँगे। अलग बिलिंग पता न हो तो बिल भी इसी पते पर बनेगा।',
          billing: 'नए ऑर्डर का बिल यहाँ बनेगा और GST इनवॉइस में यही जानकारी जाएगी।',
          both: 'नए ऑर्डर यहीं भेजे जाएँगे और बिल भी यहीं बनेगा।',
          none: 'पता-सूची में रहेगा। नए ऑर्डर में इस्तेमाल के लिए शिपिंग, बिलिंग या दोनों चुनें।',
        },
        lockedShipping: 'यह शिपिंग पता है। यहाँ भेजना बंद करने के लिए कोई दूसरा पता चुनें।',
      },
      name: 'नाम',
      phone: 'मोबाइल नंबर',
      business: {
        heading: 'बिज़नेस की जानकारी',
        billingHelp: 'GST इनवॉइस इसी कंपनी और GSTIN के नाम बनेगा।',
        shippingHelp: 'सिर्फ़ तब ज़रूरी जब इस पते पर किसी बिज़नेस को बिल करना हो।',
      },
      businessName: 'कंपनी का नाम (वैकल्पिक)',
      gstin: 'GSTIN (वैकल्पिक)',
      save: 'पता सेव करें',
      cancel: 'रद्द करें',
      saved: 'पता सेव हो गया',
      failed: 'पता सेव नहीं हो पाया',
    },
    confirm: {
      title: 'यह पता हटाएँ?',
      body: 'यह ग्राहक की पता-सूची से हट जाएगा। पुराने ऑर्डर में वही पता रहेगा जिस पर वे भेजे गए थे।',
      cancel: 'रहने दें',
      confirm: 'हटाएँ',
      done: 'पता हट गया',
      failed: 'पता नहीं हट पाया',
    },
  }),
]
