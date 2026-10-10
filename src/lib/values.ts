/** Helpers for turning Bases `Value`s into the plain strings the table renders. */
import { ListValue, NullValue, Value } from 'obsidian';

/**
 * Whether a Bases value represents "no value" — either JS `null`/`undefined`
 * (an absent property) or a `NullValue` instance (Bases' own singleton for an
 * empty one). `NullValue.toString()` returns the literal string `"null"`, so
 * treating it like a real value anywhere it's rendered or compared would show
 * that text, or sort/group it as if it were the string "null".
 */
export function isNullish(value: Value | null | undefined): value is null | undefined {
	return value == null || value instanceof NullValue;
}

/**
 * Flatten a Bases value to display strings. A `ListValue` yields one string per
 * non-empty item; a scalar yields a single-element array; no value yields `[]`.
 */
export function valueToStrings(value: Value | null): string[] {
	if (isNullish(value)) return [];
	if (value instanceof ListValue) {
		const out: string[] = [];
		for (let i = 0; i < value.length(); i++) {
			const s = value.get(i).toString();
			if (s) out.push(s);
		}
		return out;
	}
	const s = value.toString();
	return s ? [s] : [];
}
