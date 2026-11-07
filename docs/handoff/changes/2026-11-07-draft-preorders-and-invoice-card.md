# Drafts can sell pre-orders; the order page's Invoices card fits

Convert to order and Reserve items routed every line as a normal sale, so a pre-order item with no stock was refused. `draft-preorder.ts` applies checkout's product, variant and campaign rules, including the limit. A line that has to wait for stock is marked as a pre-order, and one in stock stays a normal line. The other pre-order pricing, deposit and note rules of checkout do not apply: a draft keeps the prices it was saved with.

On the order page, each invoice's details now sit on their own line, with the buttons below them.
