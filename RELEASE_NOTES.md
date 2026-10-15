# Extended Base 1.4.0

Pick your palette, read list rows without squinting, and a few bugs
that were quietly getting in the way are gone.

## 🆕 Color scheme: Notion or Apple

A new plugin-wide setting — **Obsidian Settings → Extended Base →
Color scheme** — not a per-base option, so it applies to every base at
once. The original 9-color palette is now named **Notion**; pick
**Apple** instead for the system red/orange/yellow/green/blue/purple/
pink/gray/brown palette, light and dark mode both included. Switching
takes effect the next time an already-open base re-renders — switch
tabs away and back, or just reopen it.

## 🆕 List view, stacked vertically

Each row now shows the title on its own line, then every other
property on its own line below it (a small property icon plus its
value) — instead of cramming properties into a horizontal strip next
to the title, where most of them had no room to actually be read.

## 🆕 Board card property labels

A new "Show a card property's name as" view option for the board view:
**Icon + name**, **Icon only**, **Name only**, or **None** (the
default — nothing changes unless you turn it on).

## 🐛 Fixed

- **Checkbox properties with nothing set now actually show up.** A
  checkbox with no value on a note came back as "nothing" rather than
  an unchecked `false`, so the table/list/board cell silently rendered
  empty instead of an actual checkbox you could click.
- **Resized columns can now shrink all the way to icon width.** A
  table column could never shrink below its full label's width, even
  with the label visually truncated — that's just how HTML tables
  work, `min-width` or not. Dragging one narrow now hides the label
  outright below ~48px, so the column keeps shrinking down to just its
  icon, the way it should've all along.

## Upgrading

Drop-in — no config or `.base` file changes needed. The color scheme
defaults to **Notion**, so nothing looks different until you open
Settings and switch it. List view rows will look different right away
— that's the intended layout change, not a bug.

See the [full changelog](README.md#changelog) for the complete history.
