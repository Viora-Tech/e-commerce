# Theme code editor: folders start closed, folders show draft dots (8 Nov 2026)

Online store > Themes > Edit code, file list (`components/themes/code/code-file-tree.tsx`):
- Every folder starts closed, except the folder of the file that is open. Opening or closing by hand is remembered while the editor is open.
- A folder shows the strongest dot of its files: red (problem), amber (unsaved), blue (saved but not published) or green (just published). Unpublished drafts can be found without opening every folder.
