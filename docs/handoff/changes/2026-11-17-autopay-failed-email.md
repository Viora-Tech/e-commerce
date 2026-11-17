# Email the owner when UPI AutoPay fails

When Razorpay halts a plan's UPI AutoPay mandate (its retries failed), the owner now gets an
email at once: "UPI AutoPay stopped", with a link to Plan & billing to pay by link or turn
AutoPay on again. Before, only the admin notice changed and the owner heard at the overdue email.
Issue: https://github.com/Viora-Tech/e-commerce/issues/1770.

- `plan_bill` email: new kind `autopay_failed` (subject, heading, intro, outro, WhatsApp line).
- `handleAutopayWebhook`: on `subscription.halted`, when the mandate was not already halted,
  sends it once (a repeated webhook sends nothing).

Test: `billing/autopay-halt.test.ts`.
