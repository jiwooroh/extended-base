/**
 * Pill detection: which columns render as Notion pills, and which of those are
 * multi-select (list) vs single-select (scalar). Also parses the user's
 * `pinnedColors` view option into a {@link PinnedColors} map.
 */
import { App, BasesEntry, BasesPropertyId, BasesViewConfig, ListValue } from 'obsidian';
import { PinnedColors, colorByName } from './colors';
import { propBareName } from './property-types';

/** Result of {@link computePillProps}. */
export interface PillDetection {
	/** Properties that should render as Notion pills. */
	pillProps: Set<BasesPropertyId>;
	/** The subset whose values are lists (multi-select) rather than scalars. */
	listProps: Set<BasesPropertyId>;
}

/**
 * Decide which properties render as pills. A property qualifies when:
 *  - its vault-level type is a list type (multitext/tags/aliases), OR
 *  - ANY entry holds a list for it (so mixed string/list frontmatter stays
 *    consistent across rows), OR
 *  - it is the `tags` property, OR
 *  - the user listed it in the `pillProperties` view option.
 *
 * List-typed pill properties also land in `listProps` so the select editor
 * knows whether to multi- or single-select.
 *
 * Vault-wide property types come from the undocumented-but-stable
 * `metadataTypeManager.getPropertyInfo`: a property registered as
 * multitext/tags/aliases is a list even when every visible row happens to hold
 * a bare string.
 */
export function computePillProps(
	props: BasesPropertyId[],
	entries: BasesEntry[],
	config: BasesViewConfig,
	app: App,
): PillDetection {
	const pillProps = new Set<BasesPropertyId>();
	const listProps = new Set<BasesPropertyId>();

	const userListed = config.get('pillProperties');
	const userSet = new Set(
		Array.isArray(userListed)
			? userListed.map((s) => String(s).toLowerCase().trim())
			: [],
	);

	const mtm = (app as unknown as {
		metadataTypeManager?: { getPropertyInfo?: (name: string) => unknown };
	}).metadataTypeManager;

	for (const prop of props) {
		const bare = propBareName(prop).toLowerCase();
		const display = config.getDisplayName(prop).toLowerCase();
		const info = mtm?.getPropertyInfo?.(bare) as
			| { type?: string; widget?: string }
			| string
			| undefined;
		const metaType =
			typeof info === 'string' ? info : info?.widget ?? info?.type;
		let isList =
			metaType === 'multitext' ||
			metaType === 'tags' ||
			metaType === 'aliases' ||
			metaType === 'multiselect' ||
			metaType === 'multi-select';
		if (!isList) {
			for (const entry of entries) {
				if (entry.getValue(prop) instanceof ListValue) {
					isList = true;
					break;
				}
			}
		}
		if (isList) listProps.add(prop);
		// `select` (single-choice) is a widget type some property-editing
		// plugins (e.g. Property Panels) register with metadataTypeManager —
		// it's scalar, not a list, but still pill-worthy like tags/multitext.
		const isSelect = metaType === 'select';
		if (isList || isSelect || bare === 'tags' || userSet.has(bare) || userSet.has(display)) {
			pillProps.add(prop);
		}
	}

	return { pillProps, listProps };
}

/**
 * Display text for a pill value: strips only a leading `#` (tag syntax).
 * Unlike {@link stripPath} (for link/file-path values in plain cells), a
 * pill shows its value in full, including any `/` — a select option
 * legitimately named "A/B" reads as "A/B", not truncated down to "B".
 */
export function pillLabel(raw: string): string {
	return raw.replace(/^#/, '');
}

/** Parse the `pinnedColors` view option (`value=color` entries) into a map. */
export function stripPath(str: string): string {
	if (!str || typeof str !== 'string') return str;
	if (str.match(/^https?:\/\//)) return str; // Keep URLs
	if (str.match(/\[\[.*?\]\]/)) return str; // Keep Wiki links
	if (str.includes(',')) {
		return str.split(',').map(s => {
			const trimmed = s.trim();
			return trimmed.split('/').pop() || trimmed;
		}).join(', ');
	}
	return str.split('/').pop() || str;
}

/**
 * Parses `value=color` or `value=color:opacity` (opacity 0-100, defaulting
 * to 100 when omitted — kept backward compatible with configs saved before
 * opacity existed).
 */
export function parsePinnedColors(raw: unknown): PinnedColors {
	const pinned: PinnedColors = new Map();
	if (!Array.isArray(raw)) return pinned;
	for (const item of raw) {
		const m = String(item).match(/^(.+?)\s*[=:]\s*(.+)$/);
		if (!m) continue;
		const value = m[1].trim().replace(/^#/, '').toLowerCase();
		let colorPart = m[2].trim();
		let opacity = 100;
		const opacityMatch = colorPart.match(/^(.+?):(\d{1,3})$/);
		if (opacityMatch) {
			colorPart = opacityMatch[1].trim();
			opacity = Math.max(0, Math.min(100, parseInt(opacityMatch[2], 10)));
		}
		const color = colorByName(colorPart.toLowerCase());
		if (value && color) pinned.set(value, { color, opacity });
	}
	return pinned;
}
