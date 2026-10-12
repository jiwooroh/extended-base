/**
 * One-way color sync into the Pretty Properties community plugin, so a
 * note's own property panel (and inline tags) shows the same color this
 * plugin just rendered for a list/tag/select value in a Base view.
 *
 * Pretty Properties keeps its own per-value color store
 * (`settings.propertyColors[propName][value]`, keyed by the raw frontmatter
 * property name and the value's exact text) with no public setter — its
 * `window.PrettyPropertiesApi` only exposes getters. This writes to that
 * store directly, the same way the rest of this plugin reaches into other
 * undocumented-but-stable internals (`metadataTypeManager`, Iconize's
 * frontmatter sync, …).
 *
 * Every entry this plugin writes is tagged `_extendedBaseSynced` so a later
 * pass can tell its own writes apart from a color the user picked by hand
 * through Pretty Properties' own color menu — user-picked colors are never
 * touched, even if they no longer match what this plugin would render.
 */
import { App } from 'obsidian';
import { NotionColor } from './colors';

interface PPColorEntry {
	pillColor?: unknown;
	textColor?: unknown;
	_extendedBaseSynced?: boolean;
}

interface PrettyPropertiesPluginLike {
	settings?: { propertyColors?: Record<string, Record<string, PPColorEntry>> };
	saveSettings?: () => unknown;
	saveData?: (data: unknown) => unknown;
}

/** Convert a `#rrggbb` hex color to the `{h, s, l}` shape Pretty Properties stores. */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return { h: 0, s: 0, l: 50 };
	const n = parseInt(m[1], 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;
	if (max !== min) {
		const d = max - min;
		s = d / (1 - Math.abs(2 * l - 1));
		switch (max) {
			case r: h = ((g - b) / d) % 6; break;
			case g: h = (b - r) / d + 2; break;
			default: h = (r - g) / d + 4;
		}
		h *= 60;
		if (h < 0) h += 360;
	}
	return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getPrettyProperties(app: App): PrettyPropertiesPluginLike | undefined {
	const plugins = (app as unknown as { plugins?: { plugins?: Record<string, PrettyPropertiesPluginLike> } }).plugins;
	return plugins?.plugins?.['pretty-properties'];
}

/**
 * Push one pill's resolved color into Pretty Properties, keyed by the
 * value's bare frontmatter property name and its exact text (matching how
 * Pretty Properties itself keys `propertyColors` — the raw frontmatter key,
 * and for tags the `#`-stripped text).
 *
 * No-ops silently when Pretty Properties isn't installed/enabled, and
 * leaves any entry alone that this plugin didn't write itself.
 */
export function syncPillColorToPrettyProperties(
	app: App,
	doc: Document,
	propName: string,
	value: string,
	color: NotionColor,
): void {
	if (!value) return;
	const pp = getPrettyProperties(app);
	const settings = pp?.settings;
	if (!pp || !settings) return;
	if (!settings.propertyColors) settings.propertyColors = {};
	const forProp = settings.propertyColors[propName] ?? (settings.propertyColors[propName] = {});

	const existing = forProp[value];
	if (existing && !existing._extendedBaseSynced) return; // user-set color — leave it alone

	const pillColor = color.name === 'default'
		? 'default'
		: hexToHsl(doc.body.classList.contains('theme-dark') ? color.darkBg : color.lightBg);

	if (existing && JSON.stringify(existing.pillColor) === JSON.stringify(pillColor)) return; // already in sync

	forProp[value] = { pillColor, _extendedBaseSynced: true };
	if (pp.saveSettings) void pp.saveSettings();
	else if (pp.saveData) void pp.saveData(settings);
}
