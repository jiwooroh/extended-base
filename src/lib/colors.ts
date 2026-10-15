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

/** A pinned value's color plus how opaque its pill background renders (0-100). */
export interface PinnedColorEntry {
	color: NotionColor;
	opacity: number;
}

/** A value → pinned-color map, as produced by `parsePinnedColors`. */
export type PinnedColors = Map<string, PinnedColorEntry>;

/**
 * Notion's official color palette (light/dark background + text pairs).
 * Backgrounds and text differ per theme.
 */
export const NOTION_PALETTE: NotionColor[] = [
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

/**
 * Apple's system color palette (light/dark background + text pairs). The
 * background hexes carry their own alpha channel (8-digit hex, e.g.
 * `#FF3B3026`) rather than a separate opacity value — valid CSS as-is, and
 * `applyColorVars`'s `color-mix` still composes correctly on top of it when
 * the user also pins a lower opacity.
 */
export const APPLE_PALETTE: NotionColor[] = [
	{ name: 'gray',   lightBg: '#8E8E9326', lightFg: '#8E8E93', darkBg: '#ABABAF33', darkFg: '#ABABAF' },
	{ name: 'brown',  lightBg: '#A2845E26', lightFg: '#A2845E', darkBg: '#B8A28633', darkFg: '#B8A286' },
	{ name: 'orange', lightBg: '#FF950026', lightFg: '#FF9500', darkBg: '#F4AE4333', darkFg: '#F4AE43' },
	{ name: 'yellow', lightBg: '#F0B00033', lightFg: '#F0B000', darkBg: '#FADB3C33', darkFg: '#FADB3C' },
	{ name: 'green',  lightBg: '#30B35026', lightFg: '#30B350', darkBg: '#5CD07933', darkFg: '#5CD079' },
	{ name: 'blue',   lightBg: '#007AFF26', lightFg: '#007AFF', darkBg: '#429AF333', darkFg: '#429AF3' },
	{ name: 'purple', lightBg: '#AF52DE26', lightFg: '#AF52DE', darkBg: '#C980ED33', darkFg: '#C980ED' },
	{ name: 'pink',   lightBg: '#FF2D5526', lightFg: '#FF2D55', darkBg: '#F3638033', darkFg: '#F36380' },
	{ name: 'red',    lightBg: '#FF3B3026', lightFg: '#FF3B30', darkBg: '#F26C6433', darkFg: '#F26C64' },
];

/** The color schemes selectable from the plugin's settings tab. */
export const COLOR_SCHEMES: Record<string, { label: string; palette: NotionColor[] }> = {
	notion: { label: 'Notion', palette: NOTION_PALETTE },
	apple: { label: 'Apple', palette: APPLE_PALETTE },
};

export const DEFAULT_COLOR_SCHEME = 'notion';

/** The scheme every color-resolution helper below draws from; switched at plugin load and whenever the "Color scheme" setting changes. */
let activeSchemeId: string = DEFAULT_COLOR_SCHEME;

/** Switch the active color scheme by id (falls back to Notion for an unknown id). */
export function setColorScheme(id: string): void {
	activeSchemeId = COLOR_SCHEMES[id] ? id : DEFAULT_COLOR_SCHEME;
}

/** The currently active palette (Notion by default). */
export function getActivePalette(): NotionColor[] {
	return COLOR_SCHEMES[activeSchemeId]?.palette ?? NOTION_PALETTE;
}

/** Deterministic color per tag string so pills stay stable across renders. */
export function colorFor(text: string): NotionColor {
	let h = 0;
	for (let i = 0; i < text.length; i++) {
		h = (h * 31 + text.charCodeAt(i)) >>> 0;
	}
	const palette = getActivePalette();
	return palette[h % palette.length];
}

/** Look up the active palette's entry by its color name (e.g. `"green"`); undefined if unknown. */
export function colorByName(name: string): NotionColor | undefined {
	return getActivePalette().find((c) => c.name === name);
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
	if (p) return p.color;
	if (useDefaultColor) return colorFor(text);
	return { name: 'default', lightBg: 'transparent', lightFg: 'inherit', darkBg: 'transparent', darkFg: 'inherit' };
}

/**
 * Resolve the opacity (0-100) for a pill value — 100 unless the user pinned
 * a lower one for it. Only a pinned entry carries an opacity, so a value
 * still on its deterministic hash color always renders fully opaque until
 * the user explicitly picks a color for it (opacity is a property of a
 * pinned color, not of the value by itself).
 */
export function resolvePillOpacity(text: string, pinned: PinnedColors): number {
	return pinned.get(colorKey(text))?.opacity ?? 100;
}

/**
 * Set the per-pill CSS variables on an element from an exact palette color.
 * `opacity` (0-100) fades only the background toward whatever sits behind
 * the pill (via color-mix), keeping the foreground text fully legible.
 */
export function applyColorVars(el: HTMLElement, c: NotionColor, opacity = 100): void {
	const clamped = Math.max(0, Math.min(100, opacity));
	const fade = (hex: string) =>
		clamped >= 100 ? hex : `color-mix(in srgb, ${hex} ${clamped}%, transparent)`;
	el.setCssProps({
		'--ntn-pill-bg-light': fade(c.lightBg),
		'--ntn-pill-fg-light': c.lightFg,
		'--ntn-pill-bg-dark': fade(c.darkBg),
		'--ntn-pill-fg-dark': c.darkFg,
	});
}

/** Apply a resolved pill color and opacity (pinned override ?? hash / 100%) to an element. */
export function applyPillColor(pill: HTMLElement, text: string, pinned: PinnedColors, useDefaultColor = true): void {
	applyColorVars(pill, resolvePillColor(text, pinned, useDefaultColor), resolvePillOpacity(text, pinned));
}
