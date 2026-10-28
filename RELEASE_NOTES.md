# Extended Base 1.5.1

A small internal fix — nothing visible changes.

## 🐛 Fixed

- **Title icon rendering no longer uses `innerHTML`.** A security
  linter flagged the SVG insertion for a non-Lucide icon pack's title
  icon (read off disk — see 1.5.0) as an unsafe assignment, since it
  has no way to know the source is a local file this plugin trusts.
  It's now parsed with `DOMParser` and inserted as a real DOM element
  via `appendChild` instead, so the markup is never interpreted as
  live HTML. Icons render exactly the same as before.

## Upgrading

Drop-in — no config or `.base` file changes needed, no behavior
differences to notice.

See the [full changelog](README.md#changelog) for the complete history.
