# Extended Base 1.1.1

A fourth view — **Notion Feed** — plus a round of pill, layout, and
empty-value fixes.

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

## 🐛 Empty cells no longer show the text "null"

A property with no value used to render the literal text `null` instead
of staying blank — and could even show up as a spurious `null` entry in
a pill column's own list of known values.

Bases represents "no value" with a `NullValue` object, not plain
JavaScript `null`; that object's `toString()` returns the string
`"null"`, and every "is this value empty?" check in this plugin only
compared against JS `null`/`undefined`. Fixed everywhere a value's
presence gates rendering, inline-edit prefill, sorting, and the pill
value list.

## 🐛 Scalar pills now open the select editor in `type: bases` views

Clicking a scalar pill property (e.g. a `select`-typed `status` or
`priority`) used to fall through to plain text editing instead of
opening the select menu, in a base using the legacy `type: bases` view
declaration. That declaration hands properties to the view already
normalized to their bare name (no `note.` prefix), and editability was
decided with `prop.startsWith('note.')`, which a prefix-less id never
matches. A property is now editable unless it's explicitly `file.*` or
`formula.*`.

## 🔧 Also in this release

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
- **A Notion Feed card's embedded editor no longer shows Obsidian's
  native Properties list** above the body — redundant next to the
  card's own pill meta row, and now hidden.

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
