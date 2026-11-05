# Pay online removes the transfer discount

A transfer discount exists because the money skips the gateway fee. `payOnlineInstead` now removes it when the shopper switches: the total, GST and parcels are worked out again, and the gateway attempt asks for the higher amount. A fee on the way to pay stays. A timeline note records the amount, and the result page says what paying online will cost before they press it.
