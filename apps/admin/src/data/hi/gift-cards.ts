import { giftCardListActionsContent } from '@/data/gift-cards'
import { translation } from '@/lib/i18n'

export default [
  translation(giftCardListActionsContent, {
    open: 'गिफ़्ट कार्ड देखें',
    resend: 'दोबारा भेजें',
    disable: 'बंद करें',
    enable: 'चालू करें',
    resent: (to) => `गिफ़्ट कार्ड ${to} को ईमेल किया`,
    resendFailed: 'गिफ़्ट कार्ड भेजा नहीं जा सका',
    disabled: 'गिफ़्ट कार्ड बंद किया',
    enabled: 'गिफ़्ट कार्ड चालू किया',
    failed: 'गिफ़्ट कार्ड अपडेट नहीं हो पाया',
    confirmDisable: {
      title: (n) => (n === 1 ? 'यह गिफ़्ट कार्ड बंद करें?' : `${n} गिफ़्ट कार्ड बंद करें?`),
      body: 'बंद कार्ड चेकआउट पर काम नहीं करेगा। आप इसे कभी भी फिर से चालू कर सकते हैं।',
      confirm: 'बंद करें',
      cancel: 'चालू रहने दें',
    },
    confirmResend: {
      title: (n) => `${n} गिफ़्ट कार्ड दोबारा ईमेल करें?`,
      body: 'हर कोड फिर से उसके पाने वाले को जाएगा, और पाने वाला न हो तो ग्राहक को। जिन कार्ड पर ईमेल नहीं है वे छोड़ दिए जाएंगे।',
      confirm: 'भेजें',
      cancel: 'रहने दें',
    },
  }),
]
