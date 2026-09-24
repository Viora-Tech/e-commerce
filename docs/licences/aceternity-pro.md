# Aceternity UI Pro: permission for use in the page builder

Aceternity UI Pro's standard licence allows unlimited end products but forbids themes, templates
or derivative products for sale. Using Pro components as editable blocks in our Puck editor, for
every merchant on the platform, is not clearly covered, so we asked the owner directly.

## The question (Kuldeep Saini, 2026-09-23 16:35 IST)

> I am building an e-commerce SaaS where merchants create their own store pages in a drag-and-drop
> editor (Puck). Can we include Aceternity Pro components as editable blocks in that editor,
> available to all merchants on our platform (not as downloadable source, only rendered on their
> sites)? Happy to credit Aceternity in the editor and add a link. If this needs a special
> licence, what would it cost?

## The answer (Manu Arora, founder of Aceternity UI, 2026-09-23 20:14 IST)

> As long as the code is closed source, you're good to go. We do this so that pro code doesn't get
> leaked. All good under fair use.

## Conditions we follow

1. **Closed source.** Aceternity Pro code lives only in this private repository. It is never
   published, open-sourced, shipped as a downloadable theme, or exposed to merchants as source.
   If this repository or any package is ever made public, remove or replace the Pro code first.
2. **Rendered only.** Merchants place and configure the blocks in the editor; their storefronts
   receive the normal compiled bundle, as with any other component.
3. **Credit.** Blocks built from Aceternity Pro say so in the editor's block picker, with a link to
   https://ui.aceternity.com, and each adapted file carries a comment:
   `From Aceternity UI Pro (licensed; builder use permitted by the owner, see docs/licences/aceternity-pro.md)`.

This covers Aceternity only. Magic UI Pro, shadcnblocks and other paid kits need their own
permission before their components go into builder blocks (shadcnblocks' licence explicitly
forbids website builders).

The original message is kept in Kuldeep's chat with Manu Arora; save a screenshot beside this file
(`aceternity-pro-permission.png`) for the record.
