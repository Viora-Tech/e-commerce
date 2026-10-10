# Templates: blog and post templates, usage counts, template manager

Branch `feat/template-assignment` (plan D1/D2).

- Blogs and blog posts can use alternate templates like products, collections and pages:
  migration `0101_blog_templates` adds `template_suffix` to `blog` and `article`;
  `ALTERNATE_KINDS` gains `blog` and `article`; the storefront blog and post pages render the
  alternate (and Customize's `?view=`).
- Admin: blog post form has the **Theme template** card; the blog dialog has a **Theme
  template** field (`TemplateSelectField`, which `TemplateSelectCard` now wraps).
- Template picker: each alternate shows how many resources use it (`themes.templates.assignments`,
  store-wide) and a ⋯ manager: Rename (moves the resources too; `themes.templates.rename`),
  Duplicate (`<suffix>-copy`), Delete. The default never has one. The editor refreshes the list and
  follows a renamed or deleted open template.
- Core: `packages/core/src/theme/template-assignments.ts` (counts, reassign),
  `renameTemplateAlternate` in `templates.ts`.
- Tests (not run): `packages/core/src/theme/template-assignments.test.ts`.
- Not done: the editor's resource picker does not offer blogs/posts to preview an alternate with.
