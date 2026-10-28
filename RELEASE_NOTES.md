# Extended Base 1.5.0

Title icons actually show your real icons now — any pack, not just
Lucide — and the page panel stopped letting themes see through it.

## 🐛 Title icons, actually fixed

Title icons previously showed the generic document icon for every
note, no matter what icon it actually had in Iconize. The root cause:
Iconize doesn't write a picked icon into frontmatter by default — it
keeps per-file icon assignments in its own plugin data — but the
title icon feature was reading a frontmatter property instead, which
was almost always empty.

Title icons now read a note's real Iconize-assigned icon directly,
and render the actual icon-pack SVG — any pack Iconize has installed,
not just Lucide — the same way Iconize itself resolves one, straight
off disk. Since there's no frontmatter key to configure anymore, the
now-pointless *Icon property* view option is gone; *Show title icon*
is the only title-icon setting left, in all four views.

## 🐛 Fixed

- **The Notion-style page panel is now fully opaque.** Some themes
  make `.modal` translucent (a frosted-glass blur over a
  semi-transparent background), which let the base/table underneath
  show through the panel.

## Upgrading

Drop-in — no config or `.base` file changes needed. If you'd set a
custom *Icon property* value, it's simply ignored now; title icons
read your real Iconize assignment automatically instead.

See the [full changelog](README.md#changelog) for the complete history.
