# Extended Base 1.1.2

Title icons now come from one real source, and line up the way they should.

## 🖼️ Title icons: Iconize only

The title icon's only source is now a frontmatter property. The earlier
modes — Notion's page emoji, a generic Obsidian-style file icon, a fixed
custom icon — are gone, because Obsidian has no per-file custom icon of
its own to offer. The one real source is a plugin like
[Iconize](https://github.com/FlorianWoelki/obsidian-iconize) configured
to sync each note's sidebar icon to frontmatter — so that's the only
mode now:

- **Show title icon** — on/off, shared by all four views.
- **Icon property** — the frontmatter key each note's icon lives in
  (default `icon`, matching Iconize's own default).

A note with nothing set in that property gets a plain document icon —
the same default Iconize itself shows for a file with no icon assigned.

## 🐛 Fixes

- **Title icon top-alignment, everywhere.** The icon was vertically
  centered against the title text, which only looks right for a single
  line. A title that wraps onto several lines — the board view wraps on
  purpose; the table and list can too, with *Wrap all content* on or
  just a narrow column — centered the icon against the whole wrapped
  block instead of sitting next to its first line. This was fixed for
  the board view last release but not the table/list; now top-aligned
  everywhere.
- **Board cards are tighter.** An empty card's properties section still
  claimed its container's full spacing gap against the title above it
  even with nothing inside — it's now skipped entirely, not just left
  empty, when every property is empty for that card. Card padding and
  line spacing are also tighter.

## Upgrading

Drop-in — no config or `.base` file changes needed. If you were using
the old page-emoji/theme/custom title icon modes, they're gone: set up
Iconize's frontmatter sync (or just leave *Show title icon* on and get
the plain document icon) instead.

See the [full changelog](README.md#changelog) for the complete history.
