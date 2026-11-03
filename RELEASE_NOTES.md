# Extended Base 1.6.0

Board view's folder grouping gets real nesting, scroll and collapse
state finally stick across re-renders, and non-Markdown files show
what they are.

## ✨ Added

- **Folder icon on nested subfolder headers.** Across table, list,
  feed, and board, a nested subfolder's own group header now shows a
  plain folder icon ahead of its label — a quick visual cue it's a
  subfolder, not another top-level group.
- **File-type badge for non-Markdown files.** Any file a base lists
  that isn't a plain `.md` note — a PDF, a Word doc, a canvas — now
  shows a small badge with its extension at the right edge of the
  title row.

## 🐛 Fixed

- **Board subgroups nest for real now.** Grouping a board by folder
  used to flatten every nested subfolder into one flat list under its
  top-level column — a subfolder's own subfolder sat alongside it
  instead of under it, at the same indent, and collapsing one never
  hid what was nested inside it. Subgroups now render from the real
  folder tree: each level indents further, file cards indent to
  match, and collapsing a subfolder hides everything nested under it.
- **Board scroll position no longer resets on every rebuild.**
  Collapsing or expanding a subgroup rebuilds the whole view, which
  used to reset both the board's horizontal column scroll and the
  page's vertical scroll back to the top-left every time. Both are
  now captured and restored around every re-render.
- **Collapsed subgroups stay collapsed.** Their collapsed/expanded
  state used to live only in memory, so it silently reset to
  all-expanded whenever Obsidian recreated the view — switching away
  and back, reopening the base, and so on. It's now saved in the
  view's own settings, the same way hidden groups already are.

## Upgrading

Drop-in — no config or `.base` file changes needed. Existing boards
keep their current folder grouping; subfolders just nest and indent
correctly now instead of sitting flat.

See the [full changelog](README.md#changelog) for the complete history.
