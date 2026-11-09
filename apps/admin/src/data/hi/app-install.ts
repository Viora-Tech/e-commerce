import { appInstallContent } from '@/data/app-install'
import { translation } from '@/lib/i18n'

export default [
  translation(appInstallContent, {
    steps: { connect: 'अकाउंट जोड़ें', permissions: 'अनुमतियाँ', done: 'हो गया' },
    close: 'बंद करें',
    buy: {
      title: (name: string) => `${name} खरीदें`,
      intro: (name: string, plan: string) =>
        `${name} ${plan} और ऊपर के प्लान में शामिल है। आपके प्लान पर यह हर महीने का ऐड-ऑन है; पेमेंट होते ही यह इंस्टॉल हो जाता है।`,
      price: (price: string) => `${price} / महीना + 18% GST`,
      renew:
        'हर महीने रिन्यू होता है। Plan & billing में कभी भी रोकें; भरा हुआ महीना खत्म होने तक यह चलता रहेगा।',
      plans: 'प्लान देखें',
      pay: (price: string) => `${price} / महीना में खरीदें`,
      cancel: 'रद्द करें',
      failed: 'पेमेंट शुरू नहीं हो पाया। फिर कोशिश करें।',
    },
    connect: {
      title: (name: string) => `${name} जोड़ें`,
      intro: (name: string, kind: 'payments' | 'shipping') =>
        `${name} से अपने अकाउंट की जानकारी पेस्ट करें। ${kind === 'payments' ? 'जाँच में कोई पैसा नहीं कटता।' : 'जाँच में कुछ बुक नहीं होता।'}`,
      test: 'कनेक्शन जाँचें',
      testing: 'जाँच हो रही है…',
      testHint: (name: string) => `जाँचता है कि ${name} यह जानकारी मानता है।`,
      testFailed: 'कनेक्शन की जाँच नहीं हो सकी',
      generate: 'बनाएँ',
      generateLabel: (field: string) => `${field} बनाएँ`,
      cancel: 'रद्द करें',
      continue: 'आगे बढ़ें',
      loadFailed: 'अकाउंट के फ़ील्ड लोड नहीं हो सके। एक मिनट बाद फिर कोशिश करें।',
    },
    permissions: {
      title: (name: string) => `${name} इंस्टॉल करें?`,
      intro: 'यह ऐप आपके स्टोर में ये काम कर पाएगा।',
      heading: 'यह ऐप',
      access: 'क्या देख सकता है',
      back: 'पीछे',
      cancel: 'रद्द करें',
      install: 'इंस्टॉल करें',
      failed: 'ऐप इंस्टॉल नहीं हो सका',
    },
    done: {
      title: (name: string) => `${name} तैयार है`,
      connected: 'आपका अकाउंट काम कर रहा है और सेव हो गया है।',
      builtin: 'इंस्टॉल हो गया, अब इस्तेमाल कर सकते हैं।',
      needsSetup: 'इंस्टॉल हो गया। इस्तेमाल शुरू करने के लिए अपना अकाउंट जोड़ें।',
      close: 'बंद करें',
      openApp: 'ऐप खोलें',
      connect: 'अकाउंट जोड़ें',
    },
    unknownApp: 'यह ऐप इस स्टोर में उपलब्ध नहीं है।',
    installedToast: (name: string) => `${name} इंस्टॉल हो गया`,
  }),
]
