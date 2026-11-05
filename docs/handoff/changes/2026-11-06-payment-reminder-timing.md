# Payment reminder waits 30 minutes

The "payment not finished" message went out 10 minutes after checkout, while Razorpay's window and QR could still be open, and said the payment did not go through. It now waits 30 minutes (or half the store's unpaid order window when that is shorter) and says the order is waiting for payment. The reminder runs in the worker, so this release needs a worker deploy.
