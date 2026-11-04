# A closed Razorpay window is not an order yet

We create the order before the gateway opens; Shopify creates it once paid. `paymentNotFinished`
moved to core and now also leaves out authorised cards. All Orders and Cancelled leave those
checkouts out, and `notTestOrder` does too, so sales, counts, customer pages and reports all drop
them. They wait under the Payment pending tab and search still finds them. COD and manual UPI or
bank orders are unchanged. This reverses "All shows them" (#1001, #997): the customer page now
leaves them out as well, so the two still agree.
