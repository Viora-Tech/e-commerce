import { storageWarningContent } from '@/data/storage-warning'
import { translation } from '@/lib/i18n'

export default [
  translation(storageWarningContent, {
    title: 'आपकी इमेज सर्वर की डिस्क पर रखी हैं',
    body: 'स्टोर अपडेट होने पर ये हर बार मिट जाती हैं, और ग्राहकों को शायद न दिखें। इमेज सुरक्षित रखने के लिए Cloudflare R2 या Amazon S3 जोड़ें।',
    action: 'स्टोरेज जोड़ें',
  }),
]
