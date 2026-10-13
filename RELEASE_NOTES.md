# Extended Base 1.3.0

Hide table columns you don't need right now, keep the same colors in
Pretty Properties as in your bases, and get sort order that actually
matches what the dropdown already shows.

## 🆕 Hide table columns

Right-click a column header and choose **Hide column**. A "Hidden
columns" control appears in the table's footer listing every hidden
column — click one to bring it back. The title column can't be
hidden, since a row needs at least that to identify or open the note.

## 🆕 Match colors in Pretty Properties

If you use the [Pretty Properties](https://github.com/anareaty/pretty-properties)
plugin, there's a new "Sync pill colors to Pretty Properties" view
option (off by default, in all four views). Turn it on and a pill's
resolved color here is also pushed into Pretty Properties' own color
store — so a note's real property panel, and its inline tags, show the
exact same color as this view's pills.

It's non-destructive: a color you've picked by hand through Pretty
Properties' own color menu is never overwritten, only values this
plugin hasn't touched yet (or already synced itself) get written.

## 🧠 Sort now matches the dropdown, not the alphabet

A pill/select column with no explicit drag-to-reorder saved used to
sort alphabetically by default — even though the select editor's own
dropdown already lists that column's options in first-seen order, not
alphabetical. Clicking the header now sorts by that same first-seen
order instead, so the two finally agree. Drag a row's grip handle in
the dropdown to set your own order any time; it still wins once set.

## 🐛 Fixed

- **Board card links no longer overflow.** A long, unbroken value like
  a URL in a board card's property could spill past the card's right
  edge instead of wrapping onto the next line.

## Upgrading

Drop-in — no config or `.base` file changes needed. Existing pill
columns may visually re-sort once if they had no explicit order saved
and their first-seen order differs from alphabetical; drag to set your
own order any time. The Pretty Properties sync is off by default —
turn it on per-view if you want it.

See the [full changelog](README.md#changelog) for the complete history.
