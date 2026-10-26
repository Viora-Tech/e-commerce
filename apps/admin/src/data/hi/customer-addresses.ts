import { customerAddressesContent } from '@/data/customer-addresses'
import { translation } from '@/lib/i18n'

export default [
  translation(customerAddressesContent, {
    heading: 'पते',
    add: 'पता जोड़ें',
    edit: 'बदलें',
    remove: 'हटाएँ',
    defaultShipping: 'डिफ़ॉल्ट शिपिंग',
    defaultBilling: 'डिफ़ॉल्ट बिलिंग',
    makeDefault: 'डिफ़ॉल्ट शिपिंग पता',
    makeDefaultBilling: 'डिफ़ॉल्ट बिलिंग पता',
    defaultsHelp:
      'नए ऑर्डर डिफ़ॉल्ट शिपिंग पते पर भेजे जाते हैं और बिल डिफ़ॉल्ट बिलिंग पते पर बनता है। बिलिंग डिफ़ॉल्ट न हो तो बिलिंग, शिपिंग वाला पता ही रहता है।',
    setDefault: 'डिफ़ॉल्ट शिपिंग बनाएँ',
    setDefaultBilling: 'डिफ़ॉल्ट बिलिंग बनाएँ',
    defaultSaved: 'डिफ़ॉल्ट शिपिंग पता बदल गया',
    defaultBillingSaved: 'डिफ़ॉल्ट बिलिंग पता बदल गया',
    defaultFailed: 'डिफ़ॉल्ट पता नहीं बदल पाया',
    gstinLabel: 'GSTIN',
    fromOrder: 'उनके पिछले ऑर्डर से',
    empty: 'अभी कोई सेव पता नहीं है।',
    dialog: {
      addTitle: 'पता जोड़ें',
      editTitle: 'पता बदलें',
      name: 'नाम',
      phone: 'मोबाइल नंबर',
      businessName: 'कंपनी का नाम (वैकल्पिक)',
      gstin: 'GSTIN (वैकल्पिक)',
      gstinHelp: 'इस पते पर किसी बिज़नेस के नाम GST इनवॉइस के लिए।',
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
