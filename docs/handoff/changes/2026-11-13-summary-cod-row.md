# Create shipment summary: COD fee on its own row (13 Nov 2026)

The summary card added the courier's COD fee into Freight (₹22 freight + ₹40 COD showed as
"Freight ₹62"). `summaryParts` now returns `codPaise` and the card shows a "COD fee" row (hidden
when zero, Hindi "COD शुल्क"). The rows still add up to the courier charge.
