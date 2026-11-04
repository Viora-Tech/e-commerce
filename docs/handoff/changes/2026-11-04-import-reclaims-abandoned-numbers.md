# The import takes a number back from an abandoned checkout

A closed payment window holds an order number, and the Orders import skipped any Shopify order whose
number was taken. A checkout that was never paid (`paymentNotFinished`) now moves to the next number
on a real run, and a preview changes nothing. Orders placed here and paid are still never touched.

The unpaid expiry no longer sends "order cancelled": nothing was bought.
