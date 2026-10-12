# Extended Base 1.2.0

Pill columns can now be pinned to single- or multi-select, and the
auto-detected default is smarter about which one fits.

## 🆕 Select vs. Multi-select, your choice

Right-click a pill column's header in the table view for two new
options:

- **Select (single)** — pick one value, select-and-close.
- **Multi-select** — toggle multiple values, menu stays open.
- **Auto-detect select type** (once you've overridden it) — clears the
  override and goes back to automatic.

## 🧠 Smarter auto-detection

Without an override, a pill column now decides single- vs multi-select
from the data itself: **multi-select once some entry actually holds
more than one value for it, single-select otherwise.** Previously, any
property whose vault-level frontmatter type was list-shaped (`tags`,
`multitext`, …) always defaulted to multi-select, even if every note
only ever had zero or one value in it. A freshly-created list property
now starts single-select until a note actually uses it as a real list —
and you can always pin it either way yourself.

## Upgrading

Drop-in — no config or `.base` file changes needed. Existing pill
columns keep working exactly as before unless their auto-detected
default actually changes (only ones where no entry currently has more
than one value switch from multi- to single-select) — right-click and
pin **Multi-select** if you'd rather keep one as-is.

See the [full changelog](README.md#changelog) for the complete history.
