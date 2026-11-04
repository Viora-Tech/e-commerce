# Traffic import reads real shoppers only

The query now has `WHERE human_or_bot_session = 'human'`, and a re-run clears the store's imported
days first. No migration. After deploying the admin, press **Import traffic** again and compare
1-5 Nov with Shopify's Home (1,967 sessions). Conversion is our orders over these sessions, so it
stays below Shopify's rate by design: cancelled orders are not sales here.
