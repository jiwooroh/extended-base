# Extended Base 1.1.0

A fourth view — **Notion Feed** — plus a handful of pill and layout fixes.

## 🆕 Notion Feed

A vertical feed of full note cards: title, colored pill properties, and
the note's own body right there in the card — not a read-only preview,
but the note's own live editor embedded directly, so you can read and
edit in place without opening anything else.

![A Notion Feed card with a live-editable note body](docs/asset/feed_view.png)

Pick **Notion Feed** from the base's view selector, same as the other
three. It shares the same pill colors, select editor, and folder/property
grouping as the rest of the plugin. A *Card count limit* view option
(default 5) caps how many cards render at once, since each one carries a
full embedded editor.

## 🖊️ Pill rename, now easy to find

A pencil icon now sits next to a pill's color button in the select
editor — click it to rename that value everywhere it's currently used.
(Double-clicking the pill still works too; the pencil just makes the
feature discoverable instead of hidden behind a gesture.)

![Renaming a value from the select editor](docs/asset/rename_pencil.png)

## 🔧 Fixes

- **A pill now always shows its full value.** A select option named
  `A/B` used to render as just `B` — the same last-segment stripping
  that group headers use for `/`-nested tag paths was being applied to
  every pill's own label too. Group headers are unchanged: a
  `Work/Client/Alpha` grouping still shows one level per header.
- **`select`-type properties are now recognized as pill columns.** Some
  property-editing plugins (e.g. Property Panels) register a `select`
  widget type for single-choice properties; cells for those weren't
  being picked up as pills at all, so clicking one opened Obsidian's own
  built-in list editor instead of this plugin's menu.
- **The select menu no longer occasionally fills the whole window
  height** as a mostly-empty box below its actual (much shorter)
  content.

## ⚠️ Known tradeoff: sticky table header is gone

The view no longer bounds its own height and scrolls internally
(`height: 100%; max-height: 100vh` on the view root, added in 1.0.7) — it
now grows to its natural content height and the surrounding pane scrolls
it, like any other content, instead of creating a second, separate
scrollbar. The cost: the table's column headers no longer stay pinned to
the top while you scroll past them.

## Upgrading

Drop-in — no config or `.base` file changes needed. See
[Installation](README.md#installation) if you're installing fresh.

See the [full changelog](README.md#changelog) for the complete history.
