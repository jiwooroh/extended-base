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
	/** The subset that edit as multi-select (list) rather than single-select. */
	listProps: Set<BasesPropertyId>;
}

/** A per-column manual override of single- vs multi-select, keyed by full property id. */
export type SelectTypeOverride = 'select' | 'multiselect';

/** Parse the `selectTypeOverride` view option into a lookup map. */
function parseSelectTypeOverrides(raw: unknown): Record<string, SelectTypeOverride> {
	if (!raw || typeof raw !== 'object') return {};
	const out: Record<string, SelectTypeOverride> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (value === 'select' || value === 'multiselect') out[key] = value;
	}
	return out;
}

/**
 * Decide which properties render as pills, and which of those are
 * multi-select (list) vs single-select (scalar).
 *
 * A property is pill-worthy when:
 *  - its vault-level type is a list type (multitext/tags/aliases), OR
 *  - ANY entry holds a list for it (so mixed string/list frontmatter stays
 *    consistent across rows), OR
 *  - its vault-level type is `select` (single-choice), OR
 *  - it is the `tags` property, OR
 *  - the user listed it in the `pillProperties` view option.
 *
 * Vault-wide property types come from the undocumented-but-stable
 * `metadataTypeManager.getPropertyInfo`: a property registered as
 * multitext/tags/aliases is a list even when every visible row happens to hold
 * a bare string.
 *
 * A list-shaped pill property is further classified multi- vs single-select
 * (`listProps`): a manual per-column override (the `selectTypeOverride` view
 * option, set from the table header's right-click menu) wins when present;
 * otherwise it's decided from the data itself — multi-select only once some
 * entry actually holds more than one value for it, so a property nobody has
 * used as a real list yet (every entry has zero or one value) starts out
 * single-select instead of defaulting to multi just because of its declared
 * type.
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

	const overrides = parseSelectTypeOverrides(config.get('selectTypeOverride'));

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
		const declaredList =
			metaType === 'multitext' ||
			metaType === 'tags' ||
			metaType === 'aliases' ||
			metaType === 'multiselect' ||
			metaType === 'multi-select';

		let anyListValue = false;
		let anyMultiItemValue = false;
		for (const entry of entries) {
			const value = entry.getValue(prop);
			if (value instanceof ListValue) {
				anyListValue = true;
				if (value.length() > 1) {
					anyMultiItemValue = true;
					break;
				}
			}
		}

		const isListShaped = declaredList || anyListValue;

		const override = overrides[prop];
		const isMultiSelect = override === 'multiselect' ? true
			: override === 'select' ? false
			: anyMultiItemValue;
		if (isMultiSelect) listProps.add(prop);

		// `select` (single-choice) is a widget type some property-editing
		// plugins (e.g. Property Panels) register with metadataTypeManager —
		// it's scalar, not a list, but still pill-worthy like tags/multitext.
		const isSelect = metaType === 'select';
		if (isListShaped || isSelect || bare === 'tags' || userSet.has(bare) || userSet.has(display)) {
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
