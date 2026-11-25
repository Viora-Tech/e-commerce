import { sesSetupContent } from '@/data/ses-setup'
import { translation } from '@/lib/i18n'

export default [
  translation(sesSetupContent, {
    check: {
      title: 'कनेक्शन जांच',
      checking: 'Amazon से जांच हो रही है…',
      notSaved: 'Amazon SES की जानकारी सेव करें, फिर कनेक्शन की जांच यहां होगी।',
      ready: 'Amazon SES आपके ईमेल भेजने के लिए तैयार है।',
      readyWithLimit: 'Amazon SES काम कर रहा है, एक सीमा के साथ:',
      blocked: 'इसे ठीक करने तक ईमेल नहीं जाएंगे:',
      failed: 'कनेक्शन की जांच नहीं हो सकी। एक मिनट बाद फिर कोशिश करें।',
      again: 'फिर जांचें',
      issues: {
        bad_keys: 'Amazon ने एक्सेस की या सीक्रेट नहीं माना। IAM से दोनों फिर कॉपी करके सेव करें।',
        no_permission:
          'यह एक्सेस की आपकी SES सेटिंग नहीं पढ़ सकती। इसके IAM यूज़र को SES की अनुमति दें (ses:Get* और ses:SendEmail)।',
        unreachable: 'उस रीजन में Amazon SES ने जवाब नहीं दिया। रीजन कोड जांचें, जैसे ap-south-1।',
        sending_paused: 'Amazon ने इस अकाउंट पर भेजना रोक दिया है। वजह जानने के लिए AWS में SES खोलें।',
        sandbox:
          'सैंडबॉक्स: जब तक Amazon production access नहीं देता, ईमेल सिर्फ़ आपके वेरिफ़ाई किए पतों पर जाते हैं। SES में production access माँगें।',
        from_not_verified:
          'From पता (या उसका डोमेन) इस रीजन में वेरिफ़ाई नहीं है। SES में Identities पर इसे वेरिफ़ाई करें।',
        config_set_missing: 'इस रीजन में इस नाम का कोई configuration set नहीं है।',
      },
    },
    bounces: {
      title: 'बाउंस और शिकायतें',
      body: 'ताकि दुकान उन पतों पर ईमेल भेजना बंद करे जो बाउंस होते हैं या स्पैम बताते हैं: SES में एक configuration set बनाएं, जिसका event destination बाउंस और शिकायतें एक SNS topic पर भेजे। नीचे दिया पता उस topic से (HTTPS) जोड़ें, फिर ऊपर configuration set और topic ARN भरकर सेव करें।',
      urlLabel: 'SNS topic के लिए subscription पता',
    },
  }),
]
