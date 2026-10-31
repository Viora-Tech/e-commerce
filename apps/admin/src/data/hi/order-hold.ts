import { orderHoldContent } from '@/data/order-hold'
import { translation } from '@/lib/i18n'

export default [
  translation(orderHoldContent, {
    action: 'फ़ुलफ़िलमेंट रोकें',
    chip: 'रुका हुआ',
    dialog: {
      title: 'फ़ुलफ़िलमेंट रोकें',
      body: 'जब तक आप रोक नहीं हटाते, इस ऑर्डर का कुछ भी पैक या शिप नहीं होगा।',
      reason: 'कारण',
      note: 'नोट (ज़रूरी नहीं)',
      notePlaceholder: 'किस चीज़ का इंतज़ार है?',
      cancel: 'रद्द करें',
      confirm: 'फ़ुलफ़िलमेंट रोकें',
    },
    reasons: {
      awaiting_stock: 'स्टॉक का इंतज़ार',
      address_check: 'पते की जाँच',
      payment_check: 'पेमेंट की जाँच',
      customer_request: 'ग्राहक का अनुरोध',
      other: 'अन्य',
    },
    banner: {
      title: 'फ़ुलफ़िलमेंट रुका हुआ है',
      noReason: 'कोई कारण नहीं दिया',
      by: (who, when) => `${who} ने रोका · ${when}`,
      since: (when) => `${when} से रुका है`,
      release: 'रोक हटाएँ',
    },
    held: 'फ़ुलफ़िलमेंट रोका गया',
    released: 'रोक हटा दी गई',
    failed: 'रोक नहीं बदल पाई। फिर से कोशिश करें।',
  }),
]
