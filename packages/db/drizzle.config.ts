import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema.ts',
    './src/ai-schema.ts',
    './src/api-access-schema.ts',
    './src/app-schema.ts',
    './src/automation-schema.ts',
    './src/billing-schema.ts',
    './src/channel-schema.ts',
    './src/auth-schema.ts',
    './src/marketing-schema.ts',
    './src/privacy-schema.ts',
    './src/purchasing-schema.ts',
    './src/search-console-schema.ts',
    './src/shopper-login-schema.ts',
    './src/store-data-schema.ts',
    './src/theme-schema.ts',
    // Installable apps that own tables. Their migrations join the one chain here.
    '../plugin-gst-invoices/src/schema.ts',
    '../plugin-shopify-import/src/schema.ts',
    '../plugin-back-in-stock/src/schema.ts',
    '../plugin-forms/src/schema.ts',
    '../plugin-reviews/src/schema.ts',
    '../plugin-growthbook/src/schema.ts',
  ],
  out: './drizzle',
  casing: 'snake_case',
})
