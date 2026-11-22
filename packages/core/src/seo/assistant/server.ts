/** SOURCE OF TRUTH: the SEO assistant's server surface (`@commerce/core/seo-assistant-service`) — WHAT: loading the assistant's rows and draft facts, and sending the weekly SEO email / WHY: the API and the worker read these inside RLS; client code uses `@commerce/core/seo-assistant` instead */
export * from './index'
export * from './service'
export * from './weekly-service'
