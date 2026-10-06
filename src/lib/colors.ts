/**
 * Notion "select" color palette and the helpers that map pill values to colors.
 *
 * Pure module: nothing here touches Obsidian APIs, so it can be reasoned about
 * (and unit-tested) in isolation. Colors are applied to elements through
 * per-pill CSS variables that `styles.css` consumes.
 */

/** A single palette entry: light/dark background + text pairs. */
export interface NotionColor {
	name: string;
	lightBg: string;
	lightFg: string;
	darkBg: string;
	darkFg: string;
}

/** A value → pinned-color map, as produced by `parsePinnedColors`. */
export type PinnedColors = Map<string, NotionColor>;

/**
 * Notion's official color palette (light/dark background + text pairs).
 * Backgrounds and text differ per theme.
 */
export const NOTION_COLORS: NotionColor[] = [
	{ name: 'gray',   lightBg: '#F1F1EF', lightFg: '#787774', darkBg: '#3C4144', darkFg: '#9FA4A8' },
	{ name: 'brown',  lightBg: '#F4EEEE', lightFg: '#9E6B53', darkBg: '#4C3E35', darkFg: '#D49675' },
	{ name: 'orange', lightBg: '#FBEDE7', lightFg: '#C86F21', darkBg: '#553B29', darkFg: '#E98D36' },
	{ name: 'yellow', lightBg: '#F4F1E5', lightFg: '#B57E33', darkBg: '#4A3E2C', darkFg: '#C99D46' },
	{ name: 'green',  lightBg: '#EDF3EB', lightFg: '#458262', darkBg: '#2F443A', darkFg: '#72B183' },
	{ name: 'blue',   lightBg: '#E7F3F8', lightFg: '#347EA9', darkBg: '#2D4156', darkFg: '#66AADA' },
	{ name: 'purple', lightBg: '#F4F0F7', lightFg: '#9165B0', darkBg: '#453A5B', darkFg: '#B098D8' },
	{ name: 'pink',   lightBg: '#F9EEF3', lightFg: '#C14C8A', darkBg: '#51384D', darkFg: '#DE84D1' },
	{ name: 'red',    lightBg: '#FDEBEC', lightFg: '#D34C47', darkBg: '#5E3436', darkFg: '#EA878C' },
];

/** Deterministic color per tag string so pills stay stable across renders. */
export function colorFor(text: string): NotionColor {
	let h = 0;
	for (let i = 0; i < text.length; i++) {
		h = (h * 31 + text.charCodeAt(i)) >>> 0;
	}
	return NOTION_COLORS[h % NOTION_COLORS.length];
}

/** Look up a palette entry by its Notion name (e.g. `"green"`); undefined if unknown. */
export function colorByName(name: string): NotionColor | undefined {
	return NOTION_COLORS.find((c) => c.name === name);
}

/** Normalize a pill value for color lookup: drop a leading `#`, lowercase. */
function colorKey(text: string): string {
	return text.replace(/^#/, '').toLowerCase();
}

/**
 * Resolve the color for a pill value: a user-pinned override wins, otherwise
 * the deterministic hash (if useDefaultColor is true).
 */
export function resolvePillColor(text: string, pinned: PinnedColors, useDefaultColor = true): NotionColor {
	const p = pinned.get(colorKey(text));
	if (p) return p;
	if (useDefaultColor) return colorFor(text);
	return { name: 'default', lightBg: 'transparent', lightFg: 'inherit', darkBg: 'transparent', darkFg: 'inherit' };
}

/** Set the per-pill CSS variables on an element from an exact palette color. */
export function applyColorVars(el: HTMLElement, c: NotionColor): void {
	el.setCssProps({
		'--ntn-pill-bg-light': c.lightBg,
		'--ntn-pill-fg-light': c.lightFg,
		'--ntn-pill-bg-dark': c.darkBg,
		'--ntn-pill-fg-dark': c.darkFg,
	});
}

/** Apply a resolved pill color (pinned override ?? hash) to an element. */
export function applyPillColor(pill: HTMLElement, text: string, pinned: PinnedColors, useDefaultColor = true): void {
	applyColorVars(pill, resolvePillColor(text, pinned, useDefaultColor));
}
