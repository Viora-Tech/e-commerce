import { siteConfig } from '@commerce/config/site'
import { type LegalDoc, sections } from './types'

const brand = siteConfig.brand.name
const domain = siteConfig.brand.domain
const support = siteConfig.contact.supportEmail
const company = siteConfig.company.legalName
const address = siteConfig.company.address
const grievanceEmail = 'grievance@koomerce.app'

export const privacyDoc: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy policy',
  description: `How ${brand} collects, uses, shares and deletes personal data, including data from Meta, Google and Shopify, under India’s Digital Personal Data Protection Act, 2023.`,
  lead: `How ${company} collects, uses, shares and deletes personal data, including data merchants connect from Meta, Google and Shopify, under India’s Digital Personal Data Protection Act, 2023.`,
  readMinutes: 10,
  sections: sections([
    {
      title: 'Who we are',
      plain: [`We are the company behind ${domain}.`, 'This page follows India’s DPDP Act, 2023.'],
      body: [
        `${company} (“${brand}”, “we”) runs ${domain}, the ${brand} admin and the stores merchants build with it, from ${address}. This policy explains how we handle personal data as a Data Fiduciary under the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000 and its rules.`,
        `It covers our website, the ${brand} admin (admin.${domain}) and the apps ${brand} registers on other platforms so merchants can connect them: our Meta app (WhatsApp, Facebook and Instagram catalog), our Google Cloud project (Google Merchant Center) and our Shopify app (${brand} Migration).`,
      ],
    },
    {
      title: 'Data we collect',
      plain: [
        'Your account details and what you put in your store.',
        'Card and UPI details stay with the payment partner, not us.',
      ],
      body: [
        'Account details (name, email, phone), the store data you add (products, orders, customers, settings), billing details handled by our payment partners, device and usage data (IP address, browser, pages used) and messages you send to support.',
        'When you connect another platform, we also receive the data described in the next three sections, and only after you approve it on that platform’s own consent screen.',
      ],
    },
    {
      title: 'Data from Meta (WhatsApp, Facebook, Instagram)',
      plain: [
        'Only what you approve in Facebook’s login window.',
        'Used to sync your catalog and send your order messages.',
      ],
      body: [
        `When you connect Facebook or Instagram (Sales channels) or WhatsApp (Apps → WhatsApp), Meta shows you a Facebook Login for Business window. With your approval we receive: an access token for the business assets you chose, your Facebook user id or system user id, the ids and names of the business portfolio, product catalog and WhatsApp Business account you selected, your WhatsApp phone number id, display number and quality rating, the status of your message templates, and delivery status of messages ${brand} sent for you.`,
        'Permissions we ask Meta for: catalog_management and business_management (to create one product catalog in your business and keep it in sync with your store), whatsapp_business_management and whatsapp_business_messaging (to onboard your WhatsApp number and send your order updates with templates you approved). We do not ask for permissions to read your Facebook Page posts, Instagram posts, followers, friends or personal messages, and we do not use Meta data for advertising or sell it.',
        'Meta data is used only to provide the feature you connected, is stored encrypted in your store, and is removed when you disconnect, remove our app in your Facebook settings, or ask for deletion (see Data deletion below).',
      ],
    },
    {
      title: 'Data from Google (Merchant Center)',
      plain: [
        'Only your Merchant Center, only after you approve it.',
        'We follow Google’s Limited Use rules.',
      ],
      body: [
        `When you connect Google (Sales channels → Google), Google asks you to grant ${brand} the scopes openid, email and https://www.googleapis.com/auth/content. We receive your Google account email (to show which account is connected), an OAuth access and refresh token, your Merchant Center account id, and the status of your products in Merchant Center, including which products Google disapproved and why.`,
        'We use this only to create one product data source in your own Merchant Center account, send your store’s products to it (insert, update, delete), and show you Google’s product status report in your admin. We do not read or change anything else in your Google account.',
        `${brand}’s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. We do not use Google user data for advertising, do not sell it, do not transfer it to others except as needed to provide the feature, for security, or to comply with law, and do not let humans read it except with your permission, for security or abuse investigation, to comply with law, or when it is aggregated and anonymised for internal operations. We do not use it to train AI or machine-learning models.`,
      ],
    },
    {
      title: 'Data from Shopify (migration)',
      plain: [
        'Read once, on your request, to move your store.',
        `Copied into your own ${brand} store, never back to Shopify.`,
      ],
      body: [
        `When you install our ${brand} Migration app on your Shopify store, Shopify gives us a read-only access token for the scopes you approve. On your request we read your products, inventory, collections, pages and blog content, navigation, files, metaobjects, discounts, gift cards, shipping settings, policies, purchase options, customers and orders (including customer names, emails, phone numbers and addresses, and with your approval your full order history) and copy them into your new ${brand} store.`,
        `The imported records belong to your ${brand} store, which you control; for your customers’ data you are the Data Fiduciary and we are your Data Processor. We never write to your Shopify store and keep no separate copy of Shopify customer data. When you uninstall the app, Shopify’s access token is deleted. We answer Shopify’s customers/data_request, customers/redact and shop/redact privacy requests.`,
      ],
    },
    {
      title: 'Why we use it',
      plain: ['To run your store and keep it safe.', 'Marketing only if you say yes.'],
      body: [
        `To run and secure ${brand}, provide the integrations you connect, bill you, answer support, improve the product and meet legal duties. We send marketing only with your consent.`,
      ],
    },
    {
      title: 'Consent and your choices',
      plain: ['You can take back your consent any time.', 'Disconnecting an app stops it at once.'],
      body: [
        `We process personal data with your consent or for legitimate uses allowed by the DPDP Act. You can withdraw consent any time by writing to ${support} with the subject “Withdraw consent” or, for a connected platform, by disconnecting it in the admin or removing our app on that platform. Withdrawal does not affect processing done before.`,
      ],
    },
    {
      title: 'Who we share it with',
      plain: [
        `Only partners who help run ${brand}, under contract.`,
        'Authorities only when the law says so.',
      ],
      body: [
        `Service providers (sub-processors) that help us run ${brand}, under written contracts that limit them to providing their service: Amazon Web Services (server hosting on AWS Lightsail and our database, in the Mumbai region, India; Amazon SES for sending email), Cloudflare (DNS, content delivery and security in front of our servers, hosting of this website and its forms, Turnstile bot checks, R2 storage for store media and encrypted backups), Resend (backup email delivery when Amazon SES is unavailable), Razorpay (collecting payment for our plans, including UPI AutoPay; card and UPI details stay with Razorpay) and the AI provider behind the admin’s optional AI features (the Vercel AI Gateway or OpenRouter, which pass prompts to the underlying model provider). Payment gateways, couriers and other apps a merchant connects to their own store are chosen and contracted by that merchant. Data from a connected platform goes back only to that platform, as part of the feature (for example, your products to your own Meta catalog or Merchant Center).`,
        'We share data with authorities only when the law requires it.',
      ],
      callout: {
        title: 'We never sell personal data.',
        text: 'Not to advertisers, not to data brokers, not to anyone.',
      },
    },
    {
      title: 'Your store’s customers',
      plain: [
        'Your customers’ data is yours.',
        'We only use it to run your store, as you instruct.',
      ],
      body: [
        'For data you collect from your own customers through your store (or import from Shopify), you are the Data Fiduciary and we process it on your instructions as your Data Processor.',
      ],
    },
    {
      title: 'How long we keep it',
      plain: [
        'Platform access is deleted the moment you disconnect.',
        'Account data goes after you close your account.',
      ],
      body: [
        'Access tokens and account links for Meta, Google and Shopify are kept only while the connection is active and are deleted when you disconnect, uninstall or remove our app, or ask for deletion.',
        'Other account and store data is kept while your account is active and for 90 days after, or longer where the law requires (for example tax and invoice records). Then we delete or anonymise it. Backups roll off within 30 days.',
      ],
    },
    {
      title: 'Data deletion',
      plain: ['Disconnect in the admin, or ask us.', 'Full steps are on our data deletion page.'],
      body: [
        `You can delete the data we hold from a connected platform yourself, remove our app on that platform, or ask us to delete your data at ${support}. Step-by-step instructions, including Facebook’s deletion request and how to check its status, are at https://${domain}/data-deletion.`,
      ],
    },
    {
      title: 'Security',
      plain: ['Tokens are encrypted.', 'Only the people who need access have it.'],
      body: [
        'Platform access tokens and secrets are stored encrypted; data is sent over HTTPS; each store’s data is isolated in the database; staff access is limited to what support and operations need.',
      ],
    },
    {
      title: 'Your rights',
      plain: ['See, fix or delete your data.', 'Name someone to act for you.'],
      body: [
        `You can ask to access, correct, update or erase your personal data, nominate someone to act for you, and raise a grievance. Write to ${support}.`,
      ],
    },
    {
      title: 'Grievance officer',
      plain: ['A named person handles complaints.', 'We reply within a fixed time.'],
      body: [
        `Under the DPDP Act, 2023 and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, our grievance officer is Kuldeep Saini, ${grievanceEmail}, ${address}. We acknowledge a complaint within 24 hours and resolve it within 15 days, and never later than the 90 days the DPDP Rules allow.`,
      ],
      callout: {
        title: 'Not happy with our answer?',
        text: 'You can take your complaint to the Data Protection Board of India.',
      },
    },
    {
      title: 'Changes to this policy',
      plain: ['We update this page when things change.', 'Big changes are emailed to you.'],
      body: [
        'Last updated: 24 October 2026. We tell account owners by email before a material change takes effect.',
      ],
    },
  ]),
}
