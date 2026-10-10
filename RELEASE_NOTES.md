# Extended Base 1.1.1

A small bug-fix release: two issues reported after 1.1.0, both fixed.

## 🐛 Empty cells showed the text "null"

A property with no value rendered the literal text `null` instead of
staying blank — and could even show up as a spurious `null` entry in a
pill column's own list of known values.

**Cause:** Bases represents "no value" with a `NullValue` object, not
plain JavaScript `null`. That object's `toString()` returns the string
`"null"`. Every "is this value empty?" check in this plugin compared
against JS `null`/`undefined` only, so a `NullValue` slipped through
and got rendered as text.

**Fix:** a `NullValue` is now treated as empty everywhere a value's
presence gates rendering, inline-edit prefill, sorting, and the pill
value list.

## 🐛 Scalar pills didn't open the select editor in `type: bases` views

Clicking a scalar pill property (e.g. a `select`-typed `status` or
`priority`) fell through to plain text editing instead of opening the
select menu, specifically in a base using the legacy `type: bases` view
declaration.

**Cause:** that declaration hands properties to the view already
normalized to their bare name, with no `note.` prefix. Editability was
decided with `prop.startsWith('note.')`, which a prefix-less id never
matches, so it read as read-only even though it's ordinary frontmatter.

**Fix:** a property is now editable unless it's explicitly `file.*` or
`formula.*` — matching exactly what was reported and suggested.

## Upgrading

Drop-in — no config or `.base` file changes needed.

See the [full changelog](README.md#changelog) for the complete history,
including [1.1.0](README.md#110)'s new Notion Feed view.
