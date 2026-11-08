import { customerStoreCreditContent } from '@/data/customer-store-credit'
import { translation } from '@/lib/i18n'

export default [
  translation(customerStoreCreditContent, {
    heading: 'स्टोर क्रेडिट',
    balance: 'बैलेंस',
    add: 'क्रेडिट जोड़ें',
    remove: 'क्रेडिट हटाएँ',
    empty:
      'अभी कोई स्टोर क्रेडिट नहीं। यहाँ जोड़ा गया क्रेडिट, या स्टोर क्रेडिट में रिफ़ंड, बैलेंस बनकर दिखता है जिसे ग्राहक खर्च कर सकता है।',
    history: 'इतिहास',
    by: (who: string) => `${who} ने`,
    system: 'अपने आप',
    kinds: { adjustment: 'बदलाव', payment: 'ऑर्डर का पेमेंट', refund: 'रिफ़ंड' },
    dialog: {
      addTitle: 'स्टोर क्रेडिट जोड़ें',
      removeTitle: 'स्टोर क्रेडिट हटाएँ',
      body: (balance: string) => `अभी का बैलेंस: ${balance}।`,
      amount: 'रकम (₹)',
      reason: 'वजह',
      reasonPlaceholder: 'जैसे: देर से डिलीवरी के लिए',
      reasonHint: 'इतिहास में दिखती है। ग्राहक इसे नहीं देखता।',
      tooMuch: 'यह बैलेंस से ज़्यादा है।',
      cancel: 'कैंसिल',
      saveAdd: 'क्रेडिट जोड़ें',
      saveRemove: 'क्रेडिट हटाएँ',
      added: 'स्टोर क्रेडिट जुड़ गया',
      removed: 'स्टोर क्रेडिट हट गया',
      failed: 'स्टोर क्रेडिट नहीं बदला। फिर से कोशिश करें।',
    },
    loadFailed: 'स्टोर क्रेडिट लोड नहीं हुआ।',
  }),
]
